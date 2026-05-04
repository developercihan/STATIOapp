const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const prisma = require('../services/db.service');
const { requireLogin } = require('../middlewares/auth.middleware');

// Geliştirme aşamasında engeli kaldırmak için boş bir middleware tanımlıyoruz
const loginLimiter = (req, res, next) => next();

router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur' });
        }
        
        // Veritabanından kullanıcıyı bul
        const user = await prisma.user.findFirst({
            where: {
                username: username.toLowerCase()
            }
        });
        
        if (!user) {
            return res.status(401).json({ error: 'Hatalı kullanıcı adı veya şifre' });
        }
        
        if (!user.isActive) {
            return res.status(403).json({ error: 'Hesabınız aktif değil' });
        }
        
        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) {
            return res.status(401).json({ error: 'Hatalı kullanıcı adı veya şifre' });
        }
        
        // Mağaza askıda mı kontrol et (Super Admin hariç)
        if (user.role !== 'superadmin') {
            const tenant = await prisma.tenant.findUnique({
                where: { id: user.tenantId }
            });
            if (tenant && tenant.status === 'suspended') {
                return res.status(403).json({ 
                    code: 'SUSPENDED',
                    storeName: tenant.name,
                    error: 'Mağazanız askıya alınmıştır'
                });
            }
        }
        
        req.session.userId = user.id;
        req.session.tenantId = user.tenantId; // TenantID session'a eklendi
        req.session.csrfToken = crypto.randomBytes(16).toString('hex');
        
        // Audit log ekle (Veritabanına)
        await prisma.auditLog.create({
            data: {
                userId: user.id,
                username: user.username,
                role: user.role,
                action: 'LOGIN_SUCCESS',
                entityType: 'user',
                entityId: user.id,
                tenantId: user.tenantId,
                details: JSON.stringify({})
            }
        });
        
        res.json({ 
            message: 'Giriş başarılı',
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                tenantId: user.tenantId
            }
        });
        
    } catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ error: 'Sunucu hatası (login)' });
    }
});

router.get('/logout', requireLogin, (req, res) => {
    req.session = null;
    res.status(200).json({ message: 'Çıkış yapıldı' });
});

router.get('/me', requireLogin, (req, res) => {
    const safeUser = {
        id: req.user.id,
        username: req.user.username,
        displayName: req.user.displayName,
        role: req.user.role,
        tenantId: req.user.tenantId,
        permissions: req.user.permissions || []
    };
    
    res.json({
        user: safeUser,
        csrfToken: req.session.csrfToken
    });
});

// POST /api/auth/update-profile - Profil bilgilerini güncelle
router.post('/update-profile', requireLogin, async (req, res) => {
    try {
        const { displayName, password } = req.body;
        const data = {};
        
        if (displayName) data.displayName = displayName;
        if (password) {
            if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır' });
            data.passwordHash = await bcrypt.hash(password, 10);
        }

        if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Güncellenecek veri gönderilmedi' });

        await prisma.user.update({
            where: { id: req.user.id },
            data
        });

        res.json({ message: 'Profil başarıyla güncellendi' });
    } catch(e) { 
        console.error('Profile update error:', e);
        res.status(500).json({ error: 'Profil güncelleme hatası' }); 
    }
});

// POST /api/auth/forgot-password - Şifre sıfırlama talebi
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'E-posta adresi zorunludur' });

        const user = await prisma.user.findFirst({ where: { email: email.toLowerCase() } });
        
        // Güvenlik: Kullanıcı bulunamasa bile aynı mesajı döndür (bilgi sızıntısını önle)
        if (!user) {
            return res.json({ message: 'Eğer bu e-posta ile kayıtlı bir hesap varsa, şifre sıfırlama linki gönderildi.' });
        }

        // Token oluştur (1 saat geçerli)
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 saat

        // Token'ı veritabanında sakla (permissions alanını geçici olarak kullan — ayrı tablo da oluşturulabilir)
        await prisma.user.update({
            where: { id: user.id },
            data: {
                // resetToken ve resetExpiry bilgisini JSON olarak sakla
                permissions: JSON.stringify({
                    resetToken,
                    resetExpiry: resetExpiry.toISOString(),
                    originalPermissions: user.permissions
                })
            }
        });

        // E-posta gönder
        const emailService = require('../services/notification.service');
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        await emailService.sendPasswordResetEmail(user.email, user.displayName, resetToken, baseUrl);

        res.json({ message: 'Eğer bu e-posta ile kayıtlı bir hesap varsa, şifre sıfırlama linki gönderildi.' });
    } catch (e) {
        console.error('Forgot password error:', e);
        res.status(500).json({ error: 'Şifre sıfırlama işlemi sırasında bir hata oluştu.' });
    }
});

// POST /api/auth/reset-password - Şifre sıfırlama (token ile)
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ error: 'Token ve yeni şifre zorunludur' });
        if (newPassword.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır' });

        // Token ile kullanıcıyı bul
        const users = await prisma.user.findMany();
        let targetUser = null;

        for (const u of users) {
            try {
                const perms = JSON.parse(u.permissions);
                if (perms.resetToken === token) {
                    const expiry = new Date(perms.resetExpiry);
                    if (expiry > new Date()) {
                        targetUser = { ...u, originalPermissions: perms.originalPermissions };
                    }
                    break;
                }
            } catch(e) { continue; }
        }

        if (!targetUser) {
            return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş sıfırlama linki.' });
        }

        const hash = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: targetUser.id },
            data: {
                passwordHash: hash,
                permissions: targetUser.originalPermissions || '[]'
            }
        });

        res.json({ message: 'Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz.' });
    } catch (e) {
        console.error('Reset password error:', e);
        res.status(500).json({ error: 'Şifre sıfırlama sırasında bir hata oluştu.' });
    }
});

module.exports = router;
