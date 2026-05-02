const express = require('express');
const router = express.Router();
const prisma = require('../services/db.service');
const { requireLogin } = require('../middlewares/auth.middleware');

// GET /api/payment-methods
router.get('/payment-methods', requireLogin, async (req, res) => {
    try {
        if (!prisma.paymentMethod) {
            console.warn('Prisma client not generated for PaymentMethod. Returning defaults.');
            return res.json([
                { id: 'def-1', name: 'NAKİT KASA', type: 'KASA' },
                { id: 'def-2', name: 'BANKA HESABI', type: 'BANKA' },
                { id: 'def-3', name: 'KREDİ KARTI', type: 'KREDI_KARTI' }
            ]);
        }
        let methods = await prisma.paymentMethod.findMany({
            where: { tenantId: req.user.tenantId }
        });

        // Eğer hiç metod yoksa varsayılanları ekle
        if (methods.length === 0) {
            const defaults = [
                { name: 'NAKİT KASA', type: 'KASA' },
                { name: 'BANKA HESABI', type: 'BANKA' },
                { name: 'KREDİ KARTI', type: 'KREDI_KARTI' }
            ];
            
            await prisma.paymentMethod.createMany({
                data: defaults.map(d => ({ ...d, tenantId: req.user.tenantId }))
            });
            
            methods = await prisma.paymentMethod.findMany({
                where: { tenantId: req.user.tenantId }
            });
        }

        res.json(methods);
    } catch (e) {
        console.error('Payment methods error:', e);
        res.status(500).json({ error: 'Ödeme yöntemleri yüklenemedi' });
    }
});

// POST /api/payment-methods
router.post('/payment-methods', requireLogin, async (req, res) => {
    try {
        const { name, type } = req.body;
        if (!prisma.paymentMethod) return res.status(400).json({ error: 'Sistem güncelleniyor, lütfen birazdan tekrar deneyin.' });
        const method = await prisma.paymentMethod.create({
            data: {
                name: name.toUpperCase(),
                type: type || 'KASA',
                tenantId: req.user.tenantId
            }
        });
        res.json(method);
    } catch (e) {
        res.status(500).json({ error: 'Kaydedilemedi' });
    }
});

// DELETE /api/payment-methods/:id
router.delete('/payment-methods/:id', requireLogin, async (req, res) => {
    try {
        if (!prisma.paymentMethod) return res.status(400).json({ error: 'Sistem güncelleniyor.' });
        await prisma.paymentMethod.delete({
            where: { id: req.params.id, tenantId: req.user.tenantId }
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Silinemedi' });
    }
});

module.exports = router;
