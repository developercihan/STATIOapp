const express = require('express');
const router = express.Router();
const prisma = require('../services/db.service');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { makeId } = require('../utils/helpers');
const { requireLogin, requireSuperAdmin, csrfCheck } = require('../middlewares/auth.middleware');
const emailService = require('../services/notification.service');
const fs = require('fs');
const path = require('path');

// Kayıt için engeli kaldırıyoruz
const registerLimiter = (req, res, next) => next();

// POST /api/public/register - Yeni Mağaza + Admin Kullanıcı Kaydı
router.post('/register', registerLimiter, async (req, res) => {
    try {
        const { name, email, ownerName, plan, taxOffice, taxNumber, address, phone, username, password } = req.body;

        if (!name || !email || !taxNumber) {
            return res.status(400).json({ error: 'Lütfen tüm zorunlu alanları doldurun.' });
        }

        if (!username || !password) {
            return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
        }

        // Kullanıcı adı benzersiz mi?
        const existingUser = await prisma.user.findFirst({
            where: { username: username.toLowerCase() }
        });
        if (existingUser) {
            return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' });
        }

        const hash = await bcrypt.hash(password, 10);

        // Transaction: Hem Tenant hem User oluştur
        const result = await prisma.$transaction(async (tx) => {
            // 1. Mağaza (Tenant) kaydı
            const newTenant = await tx.tenant.create({
                data: {
                    name: name,
                    officialName: name,
                    taxOffice: taxOffice || '',
                    taxNumber: taxNumber || '',
                    address: address || '',
                    phone: phone || '',
                    status: 'pending_approval',
                    plan: plan || 'startup',
                    category: 'Genel',
                    subscriptionExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    ownerEmail: email,
                    ownerName: ownerName || name + ' Sahibi'
                }
            });

            // 2. Admin kullanıcı kaydı
            const newUser = await tx.user.create({
                data: {
                    username: username.toLowerCase(),
                    displayName: ownerName || name + ' Admin',
                    email: email,
                    role: 'admin',
                    tenantId: newTenant.id,
                    passwordHash: hash,
                    permissions: '[]',
                    isActive: true
                }
            });

            return { tenant: newTenant, user: newUser };
        });

        // E-posta gönder (arka planda, hata olsa bile kayıt başarılı sayılır)
        emailService.sendWelcomeEmail(email, ownerName || name, username.toLowerCase()).catch(e => console.error('Welcome email error:', e));

        res.json({ 
            message: 'Kaydınız alındı. Onay sürecinden sonra giriş yapabilirsiniz.', 
            tenantId: result.tenant.id,
            username: result.user.username
        });
    } catch (e) {
        console.error('Registration error:', e);
        res.status(500).json({ error: 'Kayıt sırasında bir hata oluştu.' });
    }
});

// POST /api/public/simulate-payment - Sadece SuperAdmin kullanabilir
router.post('/simulate-payment', requireLogin, requireSuperAdmin, csrfCheck, async (req, res) => {
    try {
        const { tenantId } = req.body;
        if (!tenantId) return res.status(400).json({ error: 'Mağaza ID zorunludur.' });

        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) return res.status(404).json({ error: 'Mağaza bulunamadı.' });

        const currentExpiry = new Date(tenant.subscriptionExpiry || Date.now());
        const newExpiry = new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        const updated = await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                subscriptionExpiry: newExpiry,
                status: 'active'
            }
        });
        res.json({ 
            success: true, 
            message: 'Abonelik 30 gün uzatıldı.',
            newExpiry: updated.subscriptionExpiry 
        });
    } catch (e) {
        console.error('Payment simulation error:', e);
        res.status(500).json({ error: 'Ödeme işlemi sırasında bir hata oluştu.' });
    }
});

// GET /api/public/order/:token - Şifresiz Sipariş/Ödeme Sayfası Detayı
router.get('/order/:token', async (req, res) => {
    try {
        const order = await prisma.order.findUnique({
            where: { publicToken: req.params.token },
            include: { 
                items: true,
                tenant: {
                    select: { name: true, officialName: true, taxOffice: true, taxNumber: true, address: true, phone: true, settings: true }
                }
            }
        });

        if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı veya link geçersiz.' });

        // Ürün görsellerini Products tablosundan çekip items'a ekle (Prisma objesini kopyalayarak genişletiyoruz)
        const itemsWithImages = [];
        for (let item of order.items) {
            const product = await prisma.product.findUnique({
                where: {
                    kod_tenantId: {
                        kod: item.code,
                        tenantId: order.tenantId
                    }
                }
            });
            itemsWithImages.push({
                ...item,
                image: product ? product.image : null
            });
        }

        const orderData = {
            ...order,
            items: itemsWithImages
        };

        res.json(orderData);
    } catch (e) {
        console.error('Public order fetch error:', e);
        res.status(500).json({ error: 'Sipariş bilgileri alınamadı.' });
    }
});

module.exports = router;
