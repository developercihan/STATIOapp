const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const dataAccess = require('../services/dataAccess');
const pdfService = require('../services/pdf.service');
const { requireLogin, requirePermission, csrfCheck } = require('../middlewares/auth.middleware');
const { makeId } = require('../utils/helpers');

const upload = multer({ dest: process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', 'tmp') });

// GET /api/admin/receivables
router.get('/admin/receivables', requireLogin, requirePermission('receivables.manage'), async (req, res) => {
    try {
        const [receivablesData, companies] = await Promise.all([
            dataAccess.readJson('receivables.json', req.user.tenantId),
            dataAccess.readJson('companies.json', req.user.tenantId)
        ]);

        let receivables = receivablesData;
        if (req.query.status) receivables = receivables.filter(r => r.status === req.query.status);
        if (req.query.source) receivables = receivables.filter(r => r.source === req.query.source);
        if (req.query.minBalance !== undefined) receivables = receivables.filter(r => r.balance >= parseFloat(req.query.minBalance));
        if (req.query.maxBalance !== undefined) receivables = receivables.filter(r => r.balance <= parseFloat(req.query.maxBalance));
        
        // Her carinin ismini ve limitini en güncel şirket bilgisinden al
        const enriched = receivables.map(r => {
            const comp = companies.find(c => c.cariKod === r.code);
            const baseLimit = comp ? (parseFloat(comp.riskLimit) || 0) : (parseFloat(r.riskLimit) || 0);
            const balance = parseFloat(r.balance) || 0;
            
            // Dinamik Risk Limiti: Eğer cari alacaklıysa (- bakiye), alacak miktarı limite eklenir.
            const dynamicLimit = balance < 0 ? (baseLimit + Math.abs(balance)) : baseLimit;

            return {
                ...r,
                companyName: comp ? comp.ad : r.companyName,
                riskLimit: dynamicLimit,
                baseRiskLimit: baseLimit // Orijinal limiti de saklayalım gerekirse
            };
        });

        res.json(enriched);
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
            riskLimit: parseFloat(req.body.riskLimit) || 0,
            notes: notes || '',
            lastContactDate: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        const receivables = await dataAccess.readJson('receivables.json', req.user.tenantId);
        receivables.push(newRcv);
        await dataAccess.writeJson('receivables.json', receivables, req.user.tenantId);
        
        res.json({ message: 'Cari eklendi', receivable: newRcv });
    } catch (e) {
        res.status(500).json({ error: 'Cari eklenemedi' });
    }
});

// PUT /api/admin/receivables/:id
router.put('/admin/receivables/:id', requireLogin, requirePermission('receivables.manage'), csrfCheck, async (req, res) => {
    try {
        const updates = req.body;
        const receivables = await dataAccess.readJson('receivables.json', req.user.tenantId);
        const index = receivables.findIndex(r => r.id === req.params.id);
        
        if (index === -1) return res.status(404).json({ error: 'Cari bulunamadı' });
        
        receivables[index] = { ...receivables[index], ...updates, updatedAt: new Date().toISOString() };
        await dataAccess.writeJson('receivables.json', receivables, req.user.tenantId);
        res.json({ message: 'Cari güncellendi', receivable: receivables[index] });
    } catch (e) {
        res.status(500).json({ error: 'Cari güncellenemedi' });
    }
});

// DELETE /api/admin/receivables/:id
router.delete('/admin/receivables/:id', requireLogin, requirePermission('receivables.manage'), csrfCheck, async (req, res) => {
    try {
        const receivables = await dataAccess.readJson('receivables.json', req.user.tenantId);
        const filtered = receivables.filter(r => r.id !== req.params.id);
        
        if (receivables.length === filtered.length) return res.status(404).json({ error: 'Cari bulunamadı' });
        
        await dataAccess.writeJson('receivables.json', filtered, req.user.tenantId);
        res.json({ message: 'Cari silindi' });
    } catch (e) {
        res.status(500).json({ error: 'Cari silinemedi' });
    }
});

// POST /api/admin/receivables/import-xml
router.post('/admin/receivables/import-xml', requireLogin, requirePermission('receivables.manage'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'XML dosyası yüklenmedi' });
        
        const parsed = await dataAccess.readXml(req.file.path); // path is direct here for tmp upload
        if (!parsed || !parsed.cariler || !parsed.cariler.cari) {
            if(fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Geçersiz XML formatı' });
        }
        
        let imported = Array.isArray(parsed.cariler.cari) ? parsed.cariler.cari : [parsed.cariler.cari];
        let receivables = await dataAccess.readJson('receivables.json', req.user.tenantId);
        
        receivables = receivables.filter(r => r.source === 'manual');
        
        let addedCount = 0;
        imported.forEach(xmlRcv => {
            receivables.push({
                id: makeId('rcv'),
                code: xmlRcv.kod || '',
                companyName: xmlRcv.firma || '',
                phone: xmlRcv.cepTel || '',
                whatsappPhone: xmlRcv.whatsappNo || '',
                contactName: xmlRcv.yetkiliKisi || '',
                balance: parseFloat(xmlRcv.bakiye) || 0,
                status: xmlRcv.durum || 'BEKLEMEDE',
                source: 'xml',
                riskLimit: 0,
                notes: xmlRcv.gorusmeDetaylari || '',
                lastContactDate: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            addedCount++;
        });
        
        await dataAccess.writeJson('receivables.json', receivables, req.user.tenantId);
        if(fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.json({ message: `${addedCount} cari XML'den aktarıldı` });
    } catch (e) {
        if(req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'XML aktarılırken hata oluştu' });
    }
});

// GET /api/admin/receivables/export-xml
router.get('/admin/receivables/export-xml', requireLogin, requirePermission('receivables.manage'), async (req, res) => {
    try {
        const receivables = await dataAccess.readJson('receivables.json', req.user.tenantId);
        
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
        
        const fileName = 'export_cariler_' + Date.now() + '.xml';
        await dataAccess.writeXml(fileName, xmlObj, 'cariler', req.user.tenantId);
        
        const filePath = path.join(dataAccess.dataDir, req.user.tenantId, fileName);
        res.download(filePath, 'cariler.xml', () => {
             if(fs.existsSync(filePath)) fs.unlink(filePath, () => {});
        });
    } catch (e) {
        res.status(500).json({ error: 'XML dışa aktarılamadı' });
    }
});

// GET /api/admin/receivables/settings
router.get('/admin/receivables/settings', requireLogin, requirePermission('receivables.manage'), async (req, res) => {
    try {
        let settings = await dataAccess.readJson('receivable_settings.json', req.user.tenantId);
        if (Array.isArray(settings) && settings.length === 0) { 
             settings = { whatsappEnabled: false, messageTemplate: 'Sayın {yetkiliKisi}, {firma} firmasına ait güncel bakiyeniz {bakiye} TL olarak görünmektedir.' };
        }
        res.json(settings);
    } catch (e) {
        res.status(500).json({ error: 'Ayarlar okunamadı' });
    }
});

// PUT /api/admin/receivables/settings
router.put('/admin/receivables/settings', requireLogin, requirePermission('receivables.manage'), csrfCheck, async (req, res) => {
    try {
        await dataAccess.writeJson('receivable_settings.json', req.body, req.user.tenantId);
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
        
        let companiesObj = await dataAccess.readXml('companies.xml', req.user.tenantId);
        if (!companiesObj) companiesObj = { kurumlar: { kurum: [] } };
        if (!companiesObj.kurumlar) companiesObj.kurumlar = { kurum: [] };
        
        let kurumListesi = Array.isArray(companiesObj.kurumlar.kurum) ? companiesObj.kurumlar.kurum : (companiesObj.kurumlar.kurum ? [companiesObj.kurumlar.kurum] : []);
        
        const exists = kurumListesi.find(k => k.cariKod === code);
        if (exists) return res.status(400).json({ error: 'Bu kurum kodu zaten mevcut' });
        
        kurumListesi.push({ cariKod: code, ad: name });
        companiesObj.kurumlar.kurum = kurumListesi;
        
        await dataAccess.writeXml('companies.xml', companiesObj, 'kurumlar', req.user.tenantId);
        res.json({ message: 'Kurum başarıyla eklendi', company: { cariKod: code, ad: name } });
    } catch (e) {
        res.status(500).json({ error: 'Kurum eklenirken hata oluştu' });
    }
});

// GET /api/admin/receivables/:id/transactions - Ekstre Verilerini Getir
router.get('/admin/receivables/:id/transactions', requireLogin, requirePermission('receivables.manage'), async (req, res) => {
    try {
        const receivables = await dataAccess.readJson('receivables.json', req.user.tenantId);
        const cari = receivables.find(r => r.id === req.params.id);
        if (!cari) return res.status(404).json({ error: 'Cari bulunamadı' });
        
        res.json({
            companyName: cari.companyName,
            balance: cari.balance,
            transactions: cari.transactions || []
        });
    } catch (e) {
        res.status(500).json({ error: 'Hareketler okunamadı' });
    }
});

// POST /api/admin/receivables/:id/transactions - Yeni Ödeme (Tahsilat) Ekle
router.post('/admin/receivables/:id/transactions', requireLogin, requirePermission('receivables.manage'), csrfCheck, async (req, res) => {
    try {
        const { amount, description, date } = req.body;
        if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ error: 'Geçerli bir tutar giriniz' });
        
        const receivables = await dataAccess.readJson('receivables.json', req.user.tenantId);
        const idx = receivables.findIndex(r => r.id === req.params.id);
        if (idx === -1) return res.status(404).json({ error: 'Cari bulunamadı' });
        
        const payAmount = parseFloat(amount);
        const currentBalance = parseFloat(receivables[idx].balance) || 0;
        const newBalance = currentBalance - payAmount; // Ödeme bakiyeyi düşürür
        
        if (!receivables[idx].transactions) receivables[idx].transactions = [];
        
        const newTransaction = {
            id: makeId('tr'),
            date: date || new Date().toISOString(),
            description: description || 'Ödeme Alındı (Nakit/Havale)',
            amount: payAmount,
            type: 'PAYMENT',
            balanceAfter: newBalance
        };
        
        receivables[idx].transactions.push(newTransaction);
        receivables[idx].balance = newBalance;
        receivables[idx].updatedAt = new Date().toISOString();
        
        await dataAccess.writeJson('receivables.json', receivables, req.user.tenantId);
        
        await dataAccess.appendAuditLog({
            ts: new Date().toISOString(),
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role,
            action: 'PAYMENT_RECORDED',
            entityType: 'receivable',
            entityId: req.params.id,
            details: { amount: payAmount, description }
        }, req.user.tenantId);
        
        res.json({ message: 'Ödeme başarıyla kaydedildi', transaction: newTransaction, newBalance });
    } catch (e) {
        res.status(500).json({ error: 'Ödeme kaydedilemedi' });
    }
});

// GET /api/admin/receivables/:id/pdf - Ekstre PDF İndir
router.get('/admin/receivables/:id/pdf', requireLogin, requirePermission('receivables.manage'), async (req, res) => {
    try {
        const receivables = await dataAccess.readJson('receivables.json', req.user.tenantId);
        const cari = receivables.find(r => r.id === req.params.id);
        if (!cari) return res.status(404).json({ error: 'Cari bulunamadı' });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Ekstre_${cari.code}.pdf`);
        
        await pdfService.generateStatementPdf(cari, res, req.user.tenantId);
    } catch (e) {
        res.status(500).json({ error: 'PDF oluşturulamadı' });
    }
});

module.exports = router;
