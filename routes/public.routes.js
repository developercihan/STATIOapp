const express = require('express');
const router = express.Router();
const dataAccess = require('../services/dataAccess');
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

        const tenants = await dataAccess.readJson('tenants.json');
        
        // Tenant ID oluştur
        const tenantId = 'T' + String(tenants.length + 1).padStart(3, '0');

        // Yeni Mağaza (Tenant) Nesnesi
        const newTenant = {
            id: tenantId,
            name: name,
            officialName: name,
            taxOffice: taxOffice || '',
            taxNumber: taxNumber || '',
            address: address || '',
            phone: phone || '',
            status: 'pending_approval', // KRİTİK: Onay bekliyor
            plan: plan || 'basic',
            category: 'Genel',
            subscriptionExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 Hafta deneme
            ownerEmail: email,
            ownerName: ownerName || 'Mağaza Sahibi',
            createdAt: new Date().toISOString()
        };

        tenants.push(newTenant);
        await dataAccess.writeJson('tenants.json', tenants);

        // Not: Kullanıcı kaydı (users.json) onay aşamasında SuperAdmin tarafından yapılacak 
        // veya burada "pasif" bir kullanıcı oluşturulabilir. 
        // Güvenlik için onaydan sonra oluşturmayı tercih ediyoruz.

        res.json({ message: 'Kaydınız alındı. Onay sürecinden sonra giriş yapabilirsiniz.', tenantId });
    } catch (e) {
        console.error('Registration error:', e);
        res.status(500).json({ error: 'Kayıt sırasında bir hata oluştu.' });
    }
});

// POST /api/public/simulate-payment - Ödemeyi simüle et ve süreyi uzat
router.post('/simulate-payment', async (req, res) => {
    try {
        // Not: Gerçek hayatta burada Iyzico'dan gelen callback verisi doğrulanır.
        // Biz burada oturumdaki tenantId'yi kullanıyoruz.
        const tenantId = req.session.tenantId;
        if (!tenantId) return res.status(401).json({ error: 'Oturum bulunamadı. Lütfen tekrar giriş yapın.' });

        let tenants = await dataAccess.readJson('tenants.json');
        const idx = tenants.findIndex(t => t.id === tenantId);
        
        if (idx === -1) return res.status(404).json({ error: 'Mağaza bulunamadı.' });

        // Mevcut süreyi al ve 30 gün ekle
        const currentExpiry = new Date(tenants[idx].subscriptionExpiry || Date.now());
        const newExpiry = new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        tenants[idx].subscriptionExpiry = newExpiry.toISOString();
        tenants[idx].status = 'active'; // Eğer askıdaysa tekrar aktif et

        await dataAccess.writeJson('tenants.json', tenants);

        res.json({ 
            success: true, 
            message: 'Ödeme başarılı. Aboneliğiniz 30 gün uzatıldı.',
            newExpiry: tenants[idx].subscriptionExpiry 
        });
    } catch (e) {
        console.error('Payment simulation error:', e);
        res.status(500).json({ error: 'Ödeme işlemi sırasında bir hata oluştu.' });
    }
});

module.exports = router;
