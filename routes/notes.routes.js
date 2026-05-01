const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const prisma = require('../services/db.service');
const { requireLogin, requirePermission, csrfCheck } = require('../middlewares/auth.middleware');
const { makeId } = require('../utils/helpers');

const upload = multer({ dest: process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', 'tmp') });

// GET /api/admin/notes
router.get('/admin/notes', requireLogin, requirePermission('notes.manage'), async (req, res) => {
    try {
        const { type, paymentStatus, companyCode, dueDateFrom, dueDateTo } = req.query;
        let where = { tenantId: req.user.tenantId };
        
        if (type) where.type = type;
        if (paymentStatus) where.paymentStatus = paymentStatus;
        if (companyCode) where.companyCode = companyCode;
        if (dueDateFrom) where.dueDate = { gte: new Date(dueDateFrom) };
        if (dueDateTo) where.dueDate = { ...where.dueDate, lte: new Date(dueDateTo) };
        
        const notes = await prisma.note.findMany({
            where,
            orderBy: { dueDate: 'asc' }
        });
        
        res.json(notes);
    } catch (e) {
        console.error('Notes fetch error:', e);
        res.status(500).json({ error: 'Senetler okunamadı' });
    }
});

// POST /api/admin/notes
router.post('/admin/notes', requireLogin, requirePermission('notes.manage'), csrfCheck, async (req, res) => {
    try {
        const { noteNo, type, companyCode, companyName, amount, currency, issuedDate, dueDate, description } = req.body;
        
        const newNote = await prisma.note.create({
            data: {
                noteNo,
                type: type || 'BORC',
                companyCode,
                companyName,
                amount: parseFloat(amount) || 0,
                currency: currency || 'TRY',
                issuedDate: issuedDate ? new Date(issuedDate) : null,
                dueDate: dueDate ? new Date(dueDate) : null,
                paymentStatus: 'BEKLIYOR',
                description: description || '',
                tenantId: req.user.tenantId
            }
        });
        
        await prisma.auditLog.create({
            data: {
                userId: req.user.id,
                username: req.user.username,
                role: req.user.role,
                action: 'NOTE_CREATED',
                entityType: 'note',
                entityId: newNote.id,
                tenantId: req.user.tenantId,
                details: JSON.stringify({ type: newNote.type, amount: newNote.amount })
            }
        });
        
        res.json({ message: 'Senet eklendi', note: newNote });
    } catch (e) {
        console.error('Note create error:', e);
        res.status(500).json({ error: 'Senet eklenemedi' });
    }
});

// PUT /api/admin/notes/:id
router.put('/admin/notes/:id', requireLogin, requirePermission('notes.manage'), csrfCheck, async (req, res) => {
    try {
        const updates = req.body;
        const data = { ...updates, updatedAt: new Date() };

        if (updates.paymentStatus === 'ODENDI') {
            data.paidAt = new Date();
        }
        
        if (updates.issuedDate) data.issuedDate = new Date(updates.issuedDate);
        if (updates.dueDate) data.dueDate = new Date(updates.dueDate);

        const updated = await prisma.note.update({
            where: { id: req.params.id, tenantId: req.user.tenantId },
            data
        });
        res.json({ message: 'Senet güncellendi', note: updated });
    } catch (e) {
        res.status(500).json({ error: 'Senet güncellenemedi' });
    }
});

// DELETE /api/admin/notes/:id
router.delete('/api/admin/notes/:id', requireLogin, requirePermission('notes.manage'), csrfCheck, async (req, res) => {
    try {
        await prisma.note.delete({
            where: { id: req.params.id, tenantId: req.user.tenantId }
        });
        res.json({ message: 'Senet silindi' });
    } catch (e) {
        res.status(500).json({ error: 'Senet silinemedi' });
    }
});

// POST /api/admin/notes/import-xml
router.post('/admin/notes/import-xml', requireLogin, requirePermission('notes.manage'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'XML dosyası yüklenmedi' });
        const parsed = await dataAccess.readXml(req.file.path);
        if (!parsed || !parsed.senetler || !parsed.senetler.senet) {
            if(fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Geçersiz XML formatı' });
        }
        
        let imported = Array.isArray(parsed.senetler.senet) ? parsed.senetler.senet : [parsed.senetler.senet];
        const notes = await dataAccess.readJson('notes.json', req.user.tenantId);
        let addedCount = 0;
        
        imported.forEach(xmlNote => {
            notes.push({
                id: makeId('note'),
                noteNo: xmlNote.senetNo,
                type: xmlNote.tur || 'BORC',
                companyCode: xmlNote.cariKod,
                companyName: xmlNote.cariAd,
                amount: parseFloat(xmlNote.tutar) || 0,
                currency: xmlNote.paraBirimi || 'TRY',
                issuedDate: xmlNote.duzenlemeTarihi,
                dueDate: xmlNote.vadeTarihi,
                paymentStatus: xmlNote.odemeDurumu || 'BEKLIYOR',
                paidAt: null,
                description: xmlNote.aciklama || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            addedCount++;
        });
        
        await dataAccess.writeJson('notes.json', notes, req.user.tenantId);
        if(fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.json({ message: `${addedCount} senet XML'den aktarıldı` });
    } catch (e) {
        if(req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'XML aktarılırken hata oluştu' });
    }
});

// GET /api/admin/notes/export-xml
router.get('/admin/notes/export-xml', requireLogin, requirePermission('notes.manage'), async (req, res) => {
    try {
        const notes = await dataAccess.readJson('notes.json', req.user.tenantId);
        const xmlObj = {
            senetler: {
                senet: notes.map(n => ({
                    senetNo: n.noteNo,
                    tur: n.type,
                    cariKod: n.companyCode,
                    cariAd: n.companyName,
                    tutar: n.amount,
                    paraBirimi: n.currency,
                    duzenlemeTarihi: n.issuedDate,
                    vadeTarihi: n.dueDate,
                    odemeDurumu: n.paymentStatus,
                    aciklama: n.description
                }))
            }
        };
        
        const fileName = 'export_senetler_' + Date.now() + '.xml';
        await dataAccess.writeXml(fileName, xmlObj, 'senetler', req.user.tenantId);
        const filePath = path.join(dataAccess.dataDir, req.user.tenantId, fileName);
        
        res.download(filePath, 'senetler.xml', () => {
             if(fs.existsSync(filePath)) fs.unlink(filePath, () => {});
        });
    } catch (e) {
        res.status(500).json({ error: 'XML dışa aktarılamadı' });
    }
});

// GET /api/admin/notes/settings
router.get('/admin/notes/settings', requireLogin, requirePermission('notes.manage'), async (req, res) => {
    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: req.user.tenantId },
            select: { settings: true }
        });
        
        let settings = { notifyDaysBefore: 3, notifyTime: '09:00', whatsappEnabled: false, messageTemplate: 'Sayın {firma}, {vade} vadeli {tutar} tutarındaki senedinizin ödeme günü yaklaşmıştır.' };
        if (tenant && tenant.settings) {
            try {
                const ts = JSON.parse(tenant.settings);
                if (ts.notes) settings = ts.notes;
            } catch(e) {}
        }
        res.json(settings);
    } catch (e) {
        res.status(500).json({ error: 'Ayarlar okunamadı' });
    }
});

// PUT /api/admin/notes/settings
router.put('/admin/notes/settings', requireLogin, requirePermission('notes.manage'), csrfCheck, async (req, res) => {
    try {
        const tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId } });
        let currentSettings = {};
        try { currentSettings = JSON.parse(tenant.settings || '{}'); } catch(e) {}
        
        currentSettings.notes = req.body;
        
        await prisma.tenant.update({
            where: { id: req.user.tenantId },
            data: { settings: JSON.stringify(currentSettings) }
        });
        res.json({ message: 'Ayarlar kaydedildi' });
    } catch (e) {
        res.status(500).json({ error: 'Ayarlar kaydedilemedi' });
    }
});

module.exports = router;
