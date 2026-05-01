const express = require('express');
const router = express.Router();
const prisma = require('../services/db.service');
const bcrypt = require('bcryptjs');
const { makeId } = require('../utils/helpers');
const fs = require('fs');
const path = require('path');

// POST /api/public/register - Yeni Mağaza Kaydı (Onay Bekliyor Modu)
router.post('/register', async (req, res) => {
    try {
        const { name, email, ownerName, plan, taxOffice, taxNumber, address, phone } = req.body;

        if (!name || !email || !taxNumber) {
            return res.status(400).json({ error: 'Lütfen tüm zorunlu alanları doldurun.' });
        }

        // Yeni Mağaza (Tenant) Nesnesi
        const newTenant = await prisma.tenant.create({
            data: {
                name: name,
                officialName: name,
                taxOffice: taxOffice || '',
                taxNumber: taxNumber || '',
                address: address || '',
                phone: phone || '',
                status: 'pending_approval',
                plan: plan || 'basic',
                category: 'Genel',
                subscriptionExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 Hafta deneme
                ownerEmail: email,
                ownerName: ownerName || 'Mağaza Sahibi'
            }
        });

        res.json({ message: 'Kaydınız alındı. Onay sürecinden sonra giriş yapabilirsiniz.', tenantId: newTenant.id });
    } catch (e) {
        console.error('Registration error:', e);
        res.status(500).json({ error: 'Kayıt sırasında bir hata oluştu.' });
    }
});

// POST /api/public/simulate-payment - Ödemeyi simüle et ve süreyi uzat
router.post('/simulate-payment', async (req, res) => {
    try {
        const tenantId = req.session.tenantId;
        if (!tenantId) return res.status(401).json({ error: 'Oturum bulunamadı. Lütfen tekrar giriş yapın.' });

        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) return res.status(404).json({ error: 'Mağaza bulunamadı.' });

        // Mevcut süreyi al ve 30 gün ekle
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
            message: 'Ödeme başarılı. Aboneliğiniz 30 gün uzatıldı.',
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
