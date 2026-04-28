const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const dataAccess = require('../services/dataAccess');
const { requireLogin, requirePermission, csrfCheck } = require('../middlewares/auth.middleware');
const { makeId } = require('../utils/helpers');

const upload = multer({ dest: path.join(__dirname, '..', 'tmp') });

// GET /api/admin/notes
router.get('/admin/notes', requireLogin, requirePermission('notes.manage'), async (req, res) => {
    try {
        let notes = await dataAccess.readJson('notes.json', req.user.tenantId);
        
        if (req.query.type) notes = notes.filter(n => n.type === req.query.type);
        if (req.query.paymentStatus) notes = notes.filter(n => n.paymentStatus === req.query.paymentStatus);
        if (req.query.companyCode) notes = notes.filter(n => n.companyCode === req.query.companyCode);
        if (req.query.dueDateFrom) notes = notes.filter(n => n.dueDate >= req.query.dueDateFrom);
        if (req.query.dueDateTo) notes = notes.filter(n => n.dueDate <= req.query.dueDateTo);
        
        res.json(notes);
    } catch (e) {
        res.status(500).json({ error: 'Senetler okunamadı' });
    }
});

// POST /api/admin/notes
router.post('/admin/notes', requireLogin, requirePermission('notes.manage'), csrfCheck, async (req, res) => {
    try {
        const { noteNo, type, companyCode, companyName, amount, currency, issuedDate, dueDate, description } = req.body;
        
        const newNote = {
            id: makeId('note'),
            noteNo,
            type: type || 'BORC',
            companyCode,
            companyName,
            amount: parseFloat(amount) || 0,
            currency: currency || 'TRY',
            issuedDate,
            dueDate,
            paymentStatus: 'BEKLIYOR',
            paidAt: null,
            description: description || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        const notes = await dataAccess.readJson('notes.json', req.user.tenantId);
        notes.push(newNote);
        await dataAccess.writeJson('notes.json', notes, req.user.tenantId);
        
        await dataAccess.appendAuditLog({
            ts: new Date().toISOString(),
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role,
            action: 'NOTE_CREATED',
            entityType: 'note',
            entityId: newNote.id,
            details: { type: newNote.type, amount: newNote.amount }
        }, req.user.tenantId);
        
        res.json({ message: 'Senet eklendi', note: newNote });
    } catch (e) {
        res.status(500).json({ error: 'Senet eklenemedi' });
    }
});

// PUT /api/admin/notes/:id
router.put('/admin/notes/:id', requireLogin, requirePermission('notes.manage'), csrfCheck, async (req, res) => {
    try {
        const updates = req.body;
        const notes = await dataAccess.readJson('notes.json', req.user.tenantId);
        const index = notes.findIndex(n => n.id === req.params.id);
        
        if (index === -1) return res.status(404).json({ error: 'Senet bulunamadı' });
        
        if (updates.paymentStatus === 'ODENDI' && notes[index].paymentStatus !== 'ODENDI') {
            notes[index].paidAt = new Date().toISOString();
        }
        
        notes[index] = { ...notes[index], ...updates, updatedAt: new Date().toISOString() };
        await dataAccess.writeJson('notes.json', notes, req.user.tenantId);
        res.json({ message: 'Senet güncellendi', note: notes[index] });
    } catch (e) {
        res.status(500).json({ error: 'Senet güncellenemedi' });
    }
});

// DELETE /api/admin/notes/:id
router.delete('/admin/notes/:id', requireLogin, requirePermission('notes.manage'), csrfCheck, async (req, res) => {
    try {
        const notes = await dataAccess.readJson('notes.json', req.user.tenantId);
        const filtered = notes.filter(n => n.id !== req.params.id);
        
        if (notes.length === filtered.length) return res.status(404).json({ error: 'Senet bulunamadı' });
        
        await dataAccess.writeJson('notes.json', filtered, req.user.tenantId);
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
        let settings = await dataAccess.readJson('note_settings.json', req.user.tenantId);
        if (Array.isArray(settings) && settings.length === 0) { 
             settings = { notifyDaysBefore: 3, notifyTime: '09:00', whatsappEnabled: false, messageTemplate: 'Sayın {firma}, {vade} vadeli {tutar} tutarındaki senedinizin ödeme günü yaklaşmıştır.' };
        }
        res.json(settings);
    } catch (e) {
        res.status(500).json({ error: 'Ayarlar okunamadı' });
    }
});

// PUT /api/admin/notes/settings
router.put('/admin/notes/settings', requireLogin, requirePermission('notes.manage'), csrfCheck, async (req, res) => {
    try {
        await dataAccess.writeJson('note_settings.json', req.body, req.user.tenantId);
        res.json({ message: 'Ayarlar kaydedildi' });
    } catch (e) {
        res.status(500).json({ error: 'Ayarlar kaydedilemedi' });
    }
});

module.exports = router;
