const express = require('express');
const router = express.Router();
const prisma = require('../services/db.service');
const { requireLogin, requireRole, csrfCheck } = require('../middlewares/auth.middleware');
const MarketplaceService = require('../services/marketplace.service');

// POST /api/integrations/:id/test - Entegrasyon Bağlantısını Test Et
router.post('/integrations/:id/test', requireLogin, requireRole('admin'), csrfCheck, async (req, res) => {
    try {
        const { id } = req.params;
        const credentials = req.body;
        
        const result = await MarketplaceService.testConnection(id, credentials);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (e) {
        res.status(500).json({ error: 'Bağlantı testi sırasında hata oluştu: ' + e.message });
    }
});

// POST /api/integrations/:id/sync - Manuel Senkronizasyon Başlat
router.post('/integrations/:id/sync', requireLogin, requireRole('admin'), csrfCheck, async (req, res) => {
    try {
        const { id } = req.params;
        const tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId } });
        const settings = JSON.parse(tenant.settings || '{}');
        const mSettings = settings[id];

        if (!mSettings || !mSettings.apiKey) {
            return res.status(400).json({ error: 'Bu entegrasyon henüz yapılandırılmamış.' });
        }

        const result = await MarketplaceService.syncOrders(req.user.tenantId, id, mSettings);
        
        res.json({ 
            message: `${id.toUpperCase()} senkronizasyonu tamamlandı.`,
            details: result
        });
    } catch (e) {
        res.status(500).json({ error: 'Senkronizasyon hatası: ' + e.message });
    }
});

module.exports = router;
