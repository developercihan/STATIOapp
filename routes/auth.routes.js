const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const dataAccess = require('../services/dataAccess');
const { requireLogin } = require('../middlewares/auth.middleware');

const usersPath = path.join(dataAccess.dataDir, 'users.json');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    message: { error: 'Çok fazla giriş denemesi, lütfen 15 dakika sonra tekrar deneyin.' },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});

router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur' });
        }
        
        const users = await dataAccess.readJson('users.json');
        const user = users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase());
        
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
            const tenants = await dataAccess.readJson('tenants.json');
            const tenant = tenants.find(t => t.id === user.tenantId);
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
        
        await dataAccess.appendAuditLog({
            ts: new Date().toISOString(),
            userId: user.id,
            username: user.username,
            role: user.role,
            action: 'LOGIN_SUCCESS',
            entityType: 'user',
            entityId: user.id,
            details: {}
        }, user.tenantId); // Audit log için tenantId gönderildi
        
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

module.exports = router;
