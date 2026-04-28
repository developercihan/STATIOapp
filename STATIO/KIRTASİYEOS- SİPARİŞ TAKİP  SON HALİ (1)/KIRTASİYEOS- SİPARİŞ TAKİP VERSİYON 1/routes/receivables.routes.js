const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const dataAccess = require('../services/dataAccess');
const { requireLogin, requirePermission, csrfCheck } = require('../middlewares/auth.middleware');
const { makeId } = require('../utils/helpers');

const receivablesPath = path.join(dataAccess.dataDir, 'receivables.json');
const settingsPath = path.join(dataAccess.dataDir, 'receivable_settings.json');
const companiesPath = path.join(dataAccess.dataDir, 'companies.xml');

const upload = multer({ dest: path.join(__dirname, '..', 'tmp') });

// GET /api/admin/receivables
router.get('/admin/receivables', requireLogin, requirePermission('receivables.manage'), async (req, res) => {
    try {
        let receivables = await dataAccess.readJson(receivablesPath);
        
        if (req.query.status) receivables = receivables.filter(r => r.status === req.query.status);
        if (req.query.source) receivables = receivables.filter(r => r.source === req.query.source);
        if (req.query.minBalance !== undefined) receivables = receivables.filter(r => r.balance >= parseFloat(req.query.minBalance));
        if (req.query.maxBalance !== undefined) receivables = receivables.filter(r => r.balance <= parseFloat(req.query.maxBalance));
        
        res.json(receivables);
    } catch (e) {
        res.status(500).json({ error: 'Cariler okunamadı' });
    }
});

// POST /api/admin/receivables
router.post('/admin/receivables', requireLogin, requirePermission('receivables.manage'), csrfCheck, async (req, res) => {
    try {
        const { code, companyName, phone, whatsappPhone, contactName, balance, status, notes } = req.body;
        
        const newRcv = {
            id: makeId('rcv'),
            code,
            companyName,
            phone: phone || '',
            whatsappPhone: whatsappPhone || '',
            contactName: contactName || '',
            balance: parseFloat(balance) || 0,
            status: status || 'BEKLEMEDE',
            source: 'manual',
            notes: notes || '',
            lastContactDate: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        const receivables = await dataAccess.readJson(receivablesPath);
        receivables.push(newRcv);
        await dataAccess.writeJson(receivablesPath, receivables);
        
        res.json({ message: 'Cari eklendi', receivable: newRcv });
    } catch (e) {
        res.status(500).json({ error: 'Cari eklenemedi' });
    }
});

// PUT /api/admin/receivables/:id
router.put('/admin/receivables/:id', requireLogin, requirePermission('receivables.manage'), csrfCheck, async (req, res) => {
    try {
        const updates = req.body;
        const receivables = await dataAccess.readJson(receivablesPath);
        const index = receivables.findIndex(r => r.id === req.params.id);
        
        if (index === -1) return res.status(404).json({ error: 'Cari bulunamadı' });
        
        receivables[index] = { ...receivables[index], ...updates, updatedAt: new Date().toISOString() };
        await dataAccess.writeJson(receivablesPath, receivables);
        res.json({ message: 'Cari güncellendi', receivable: receivables[index] });
    } catch (e) {
        res.status(500).json({ error: 'Cari güncellenemedi' });
    }
});

// DELETE /api/admin/receivables/:id
router.delete('/admin/receivables/:id', requireLogin, requirePermission('receivables.manage'), csrfCheck, async (req, res) => {
    try {
        const receivables = await dataAccess.readJson(receivablesPath);
        const filtered = receivables.filter(r => r.id !== req.params.id);
        
        if (receivables.length === filtered.length) return res.status(404).json({ error: 'Cari bulunamadı' });
        
        await dataAccess.writeJson(receivablesPath, filtered);
        res.json({ message: 'Cari silindi' });
    } catch (e) {
        res.status(500).json({ error: 'Cari silinemedi' });
    }
});

// POST /api/admin/receivables/import-xml
router.post('/admin/receivables/import-xml', requireLogin, requirePermission('receivables.manage'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'XML dosyası yüklenmedi' });
        
        const parsed = await dataAccess.readXml(req.file.path);
        if (!parsed || !parsed.cariler || !parsed.cariler.cari) {
            return res.status(400).json({ error: 'Geçersiz XML formatı' });
        }
        
        let imported = Array.isArray(parsed.cariler.cari) ? parsed.cariler.cari : [parsed.cariler.cari];
        
        let receivables = await dataAccess.readJson(receivablesPath);
        
        // Akıllı senkronizasyon: Sadece 'manual' kaynaklı olanları tut
        receivables = receivables.filter(r => r.source === 'manual');
        
        let addedCount = 0;
        
        imported.forEach(xmlRcv => {
            const newRcv = {
                id: makeId('rcv'),
                code: xmlRcv.kod || '',
                companyName: xmlRcv.firma || '',
                phone: xmlRcv.cepTel || '',
                whatsappPhone: xmlRcv.whatsappNo || '',
                contactName: xmlRcv.yetkiliKisi || '',
                balance: parseFloat(xmlRcv.bakiye) || 0,
                status: xmlRcv.durum || 'BEKLEMEDE',
                source: 'xml',
                notes: xmlRcv.gorusmeDetaylari || '',
                lastContactDate: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            receivables.push(newRcv);
            addedCount++;
        });
        
        await dataAccess.writeJson(receivablesPath, receivables);
        
        fs.unlinkSync(req.file.path);
        res.json({ message: `${addedCount} cari XML'den aktarıldı (eski XML kayıtları temizlendi)` });
    } catch (e) {
        res.status(500).json({ error: 'XML aktarılırken hata oluştu' });
    }
});

// GET /api/admin/receivables/export-xml
router.get('/admin/receivables/export-xml', requireLogin, requirePermission('receivables.manage'), async (req, res) => {
    try {
        const receivables = await dataAccess.readJson(receivablesPath);
        
        const xmlObj = {
            cariler: {
                cari: receivables.map(r => ({
                    kod: r.code,
                    firma: r.companyName,
                    yetkiliKisi: r.contactName,
                    cepTel: r.phone,
                    whatsappNo: r.whatsappPhone,
                    bakiye: r.balance,
                    durum: r.status,
                    gorusmeDetaylari: r.notes
                }))
            }
        };
        
        const tmpPath = path.join(__dirname, '..', 'tmp', 'export_cariler_' + Date.now() + '.xml');
        await dataAccess.writeXml(tmpPath, xmlObj);
        
        res.download(tmpPath, 'cariler.xml', () => {
             fs.unlink(tmpPath, () => {});
        });
    } catch (e) {
        res.status(500).json({ error: 'XML dışa aktarılamadı' });
    }
});

// GET /api/admin/receivables/settings
router.get('/admin/receivables/settings', requireLogin, requirePermission('receivables.manage'), async (req, res) => {
    try {
        let settings = await dataAccess.readJson(settingsPath);
        if (Array.isArray(settings) && settings.length === 0) { 
             settings = { whatsappEnabled: false, messageTemplate: 'Sayın {yetkiliKisi}, {firma} firmasına ait güncel bakiyeniz {bakiye} TL olarak görünmektedir.' };
        }
        res.json(settings);
    } catch (e) {
        res.status(500).json({ error: 'Ayarlar okunamadı' });
    } // WhatsApp gönderim servisleri atlanmıştır
});

// PUT /api/admin/receivables/settings
router.put('/admin/receivables/settings', requireLogin, requirePermission('receivables.manage'), csrfCheck, async (req, res) => {
    try {
        const settings = req.body;
        await dataAccess.writeJson(settingsPath, settings);
        res.json({ message: 'Ayarlar kaydedildi' });
    } catch (e) {
        res.status(500).json({ error: 'Ayarlar kaydedilemedi' });
    }
});

// POST /api/companies/quick-create
router.post('/companies/quick-create', requireLogin, csrfCheck, async (req, res) => {
    try {
        const { code, name } = req.body;
        if (!code || !name) return res.status(400).json({ error: 'Cari kod ve isim zorunludur' });
        
        let companiesObj = await dataAccess.readXml(companiesPath);
        if (!companiesObj) companiesObj = { kurumlar: { kurum: [] } };
        if (!companiesObj.kurumlar) companiesObj.kurumlar = { kurum: [] };
        
        let kurumListesi = Array.isArray(companiesObj.kurumlar.kurum) ? companiesObj.kurumlar.kurum : (companiesObj.kurumlar.kurum ? [companiesObj.kurumlar.kurum] : []);
        
        const exists = kurumListesi.find(k => k.cariKod === code);
        if (exists) {
            return res.status(400).json({ error: 'Bu kurum kodu zaten mevcut' });
        }
        
        kurumListesi.push({ cariKod: code, ad: name });
        companiesObj.kurumlar.kurum = kurumListesi;
        
        await dataAccess.writeXml(companiesPath, companiesObj);
        
        res.json({ message: 'Kurum başarıyla eklendi', company: { cariKod: code, ad: name } });
    } catch (e) {
        res.status(500).json({ error: 'Kurum eklenirken hata oluştu' });
    }
});

module.exports = router;
