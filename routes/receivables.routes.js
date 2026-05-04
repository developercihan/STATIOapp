const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const prisma = require('../services/db.service');
const pdfService = require('../services/pdf.service');
const xmlService = require('../services/xml.service');
const { requireLogin, requirePermission, csrfCheck } = require('../middlewares/auth.middleware');
const { makeId } = require('../utils/helpers');

const upload = multer({ dest: process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', 'tmp') });

// GET /api/admin/receivables
router.get('/admin/receivables', requireLogin, requirePermission('receivables.manage'), async (req, res) => {
    try {
        const { status, source, minBalance, maxBalance } = req.query;
        let where = { tenantId: req.user.tenantId };

        if (status) where.status = status;
        if (source) where.source = source;
        if (minBalance) where.balance = { gte: parseFloat(minBalance) };
        if (maxBalance) where.balance = { ...where.balance, lte: parseFloat(maxBalance) };

        const [receivables, companies] = await Promise.all([
            prisma.receivable.findMany({ where }),
            prisma.company.findMany({ where: { tenantId: req.user.tenantId } })
        ]);

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
                baseRiskLimit: baseLimit
            };
        });

        res.json(enriched);
    } catch (e) {
        console.error('Receivables fetch error:', e);
        res.status(500).json({ error: 'Cariler okunamadı' });
    }
});

// POST /api/admin/receivables
router.post('/admin/receivables', requireLogin, requirePermission('receivables.manage'), csrfCheck, async (req, res) => {
    try {
        const { code, companyName, phone, whatsappPhone, contactName, balance, status, notes, riskLimit } = req.body;
        
        const newRcv = await prisma.receivable.create({
            data: {
                code,
                companyName,
                phone: phone || '',
                whatsappPhone: whatsappPhone || '',
                contactName: contactName || '',
                balance: parseFloat(balance) || 0,
                status: status || 'BEKLEMEDE',
                source: 'manual',
                riskLimit: parseFloat(riskLimit) || 0,
                notes: notes || '',
                tenantId: req.user.tenantId
            }
        });
        
        res.json({ message: 'Cari eklendi', receivable: newRcv });
    } catch (e) {
        console.error('Receivable create error:', e);
        res.status(500).json({ error: 'Cari eklenemedi' });
    }
});

// PUT /api/admin/receivables/:id
router.put('/admin/receivables/:id', requireLogin, requirePermission('receivables.manage'), csrfCheck, async (req, res) => {
    try {
        const updates = req.body;
        const updated = await prisma.receivable.update({
            where: { id: req.params.id, tenantId: req.user.tenantId },
            data: {
                ...updates,
                updatedAt: new Date()
            }
        });
        res.json({ message: 'Cari güncellendi', receivable: updated });
    } catch (e) {
        res.status(500).json({ error: 'Cari güncellenemedi' });
    }
});

// DELETE /api/admin/receivables/:id
router.delete('/admin/receivables/:id', requireLogin, requirePermission('receivables.manage'), csrfCheck, async (req, res) => {
    try {
        await prisma.receivable.delete({
            where: { id: req.params.id, tenantId: req.user.tenantId }
        });
        res.json({ message: 'Cari silindi' });
    } catch (e) {
        res.status(500).json({ error: 'Cari silinemedi' });
    }
});

// POST /api/admin/receivables/import-xml
router.post('/admin/receivables/import-xml', requireLogin, requirePermission('receivables.manage'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'XML dosyası yüklenmedi' });
        
        const parsed = await xmlService.parseXmlFile(req.file.path);
        if (!parsed || !parsed.cariler || !parsed.cariler.cari) {
            if(fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Geçersiz XML formatı' });
        }
        
        let imported = Array.isArray(parsed.cariler.cari) ? parsed.cariler.cari : [parsed.cariler.cari];
        let addedCount = 0;
        
        for (const xmlRcv of imported) {
            const code = xmlRcv.kod || '';
            if (!code) continue;

            await prisma.receivable.upsert({
                where: { code_tenantId: { code, tenantId: req.user.tenantId } },
                update: {
                    companyName: xmlRcv.firma || code,
                    phone: xmlRcv.cepTel || '',
                    whatsappPhone: xmlRcv.whatsappNo || '',
                    contactName: xmlRcv.yetkiliKisi || '',
                    notes: xmlRcv.gorusmeDetaylari || '',
                    updatedAt: new Date()
                },
                create: {
                    code,
                    companyName: xmlRcv.firma || code,
                    phone: xmlRcv.cepTel || '',
                    whatsappPhone: xmlRcv.whatsappNo || '',
                    contactName: xmlRcv.yetkiliKisi || '',
                    balance: parseFloat(xmlRcv.bakiye) || 0,
                    status: xmlRcv.durum || 'BEKLEMEDE',
                    source: 'xml',
                    riskLimit: 0,
                    notes: xmlRcv.gorusmeDetaylari || '',
                    tenantId: req.user.tenantId
                }
            });
            addedCount++;
        }
        
        if(fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.json({ message: `${addedCount} cari XML'den aktarıldı` });
    } catch (e) {
        console.error('Receivables XML import error:', e);
        if(req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'XML aktarılırken hata oluştu' });
    }
});

// GET /api/admin/receivables/export-xml
router.get('/admin/receivables/export-xml', requireLogin, requirePermission('receivables.manage'), async (req, res) => {
    try {
        const receivables = await prisma.receivable.findMany({
            where: { tenantId: req.user.tenantId }
        });

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

        const xmlContent = xmlService.buildXmlString(xmlObj);
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=cariler.xml');
        res.send(xmlContent);
    } catch (e) {
        console.error('Receivables XML export error:', e);
        res.status(500).json({ error: 'XML dışa aktarılamadı' });
    }
});

// GET /api/admin/receivables/settings
router.get('/admin/receivables/settings', requireLogin, requirePermission('receivables.manage'), async (req, res) => {
    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: req.user.tenantId },
            select: { settings: true }
        });
        
        let settings = { whatsappEnabled: false, messageTemplate: 'Sayın {yetkiliKisi}, {firma} firmasına ait güncel bakiyeniz {bakiye} TL olarak görünmektedir.' };
        if (tenant && tenant.settings) {
            try {
                const ts = JSON.parse(tenant.settings);
                if (ts.receivables) settings = ts.receivables;
            } catch(err) {}
        }
        res.json(settings);
    } catch (e) {
        res.status(500).json({ error: 'Ayarlar okunamadı' });
    }
});

// PUT /api/admin/receivables/settings
router.put('/admin/receivables/settings', requireLogin, requirePermission('receivables.manage'), csrfCheck, async (req, res) => {
    try {
        const tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId } });
        let currentSettings = {};
        try { currentSettings = JSON.parse(tenant.settings || '{}'); } catch(e) {}
        
        currentSettings.receivables = req.body;
        
        await prisma.tenant.update({
            where: { id: req.user.tenantId },
            data: { settings: JSON.stringify(currentSettings) }
        });
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
        
        const exists = await prisma.company.findUnique({
            where: { cariKod_tenantId: { cariKod: code, tenantId: req.user.tenantId } }
        });
        if (exists) return res.status(400).json({ error: 'Bu kurum kodu zaten mevcut' });
        
        await prisma.company.create({
            data: {
                cariKod: code,
                ad: name,
                tenantId: req.user.tenantId
            }
        });

        res.json({ message: 'Kurum başarıyla eklendi', company: { cariKod: code, ad: name } });
    } catch (e) {
        console.error('Quick-create company error:', e);
        res.status(500).json({ error: 'Kurum eklenirken hata oluştu' });
    }
});

// GET /api/admin/receivables/:id/transactions - Ekstre Verilerini Getir
router.get('/admin/receivables/:id/transactions', requireLogin, requirePermission('receivables.manage'), async (req, res) => {
    try {
        const cari = await prisma.receivable.findUnique({
            where: { id: req.params.id, tenantId: req.user.tenantId },
            include: { transactions: { orderBy: { date: 'desc' } } }
        });
        
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
        
        const payAmount = parseFloat(amount);

        const result = await prisma.$transaction(async (tx) => {
            const cari = await tx.receivable.findUnique({
                where: { id: req.params.id, tenantId: req.user.tenantId }
            });
            if (!cari) throw new Error('Cari bulunamadı');

            const newBalance = (parseFloat(cari.balance) || 0) - payAmount;

            const tr = await tx.transaction.create({
                data: {
                    receivableId: cari.id,
                    date: date ? new Date(date) : new Date(),
                    description: description || 'Ödeme Alındı (Nakit/Havale)',
                    amount: payAmount,
                    type: 'PAYMENT',
                    balanceAfter: newBalance
                }
            });

            await tx.receivable.update({
                where: { id: cari.id },
                data: { balance: newBalance, updatedAt: new Date() }
            });

            await tx.auditLog.create({
                data: {
                    userId: req.user.id,
                    username: req.user.username,
                    role: req.user.role,
                    action: 'PAYMENT_RECORDED',
                    entityType: 'receivable',
                    entityId: req.params.id,
                    tenantId: req.user.tenantId,
                    details: JSON.stringify({ amount: payAmount, description })
                }
            });

            return { tr, newBalance };
        });
        
        res.json({ message: 'Ödeme başarıyla kaydedildi', transaction: result.tr, newBalance: result.newBalance });
    } catch (e) {
        console.error('Payment error:', e);
        res.status(500).json({ error: 'Ödeme kaydedilemedi' });
    }
});

// GET /api/admin/receivables/:id/pdf - Ekstre PDF İndir
router.get('/admin/receivables/:id/pdf', requireLogin, requirePermission('receivables.manage'), async (req, res) => {
    try {
        const cari = await prisma.receivable.findUnique({
            where: { id: req.params.id, tenantId: req.user.tenantId },
            include: { transactions: { orderBy: { date: 'desc' } } }
        });
        if (!cari) return res.status(404).json({ error: 'Cari bulunamadı' });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Ekstre_${cari.code}.pdf`);
        
        await pdfService.generateStatementPdf(cari, res, req.user.tenantId);
    } catch (e) {
        console.error('PDF error:', e);
        res.status(500).json({ error: 'PDF oluşturulamadı' });
    }
});

module.exports = router;
