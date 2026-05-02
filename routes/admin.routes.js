const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
let sharp;
try { sharp = require('sharp'); } catch(e) { sharp = null; console.warn('sharp yüklenemedi (Vercel ortamı)'); }
const bcrypt = require('bcryptjs');
const prisma = require('../services/db.service');
const xmlService = require('../services/xml.service');
const excelService = require('../services/excel.service');
const { upload: cloudinaryUpload } = require('../services/storage.service');
const { requireLogin, requirePermission, requireRole, csrfCheck } = require('../middlewares/auth.middleware');
const { makeId } = require('../utils/helpers');

const upload = multer({ dest: process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', 'tmp') });
const imageUpload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// --- GENEL VERİ LİSTELEME ---

router.get('/products', requireLogin, async (req, res) => {
    try {
        const { search } = req.query;
        let where = { tenantId: req.user.tenantId };
        
        if (search) {
            const s = search.toLowerCase();
            where.OR = [
                { kod: { contains: s } },
                { ad: { contains: s } }
            ];
        }
        
        const products = await prisma.product.findMany({ where });
        res.json(products);
    } catch(e) { res.status(500).json({error: 'Ürünler okunamadı'}); }
});

// POST /api/admin/products/:code/image
router.post('/admin/products/:code/image', requireLogin, requireRole('admin'), csrfCheck, cloudinaryUpload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Resim dosyası yüklenmedi' });
        
        const { code } = req.params;
        const tenantId = req.user.tenantId;

        // Cloudinary zaten resmi yükledi ve bize URL verdi (req.file.path)
        const imageUrl = req.file.path;
            
        // Veritabanını güncelle
        await prisma.product.update({
            where: { kod_tenantId: { kod: code, tenantId } },
            data: { image: imageUrl }
        });
        
        res.json({ message: 'Resim yüklendi', path: imageUrl });
    } catch (e) {
        console.error('Image upload error:', e);
        res.status(500).json({ error: 'Resim işlenirken hata oluştu' });
    }
});

router.get('/distributors', requireLogin, async (req, res) => {
    try {
        const dists = await prisma.user.findMany({
            where: { tenantId: req.user.tenantId, role: 'distributor' },
            select: { id: true, username: true, displayName: true, isActive: true }
        });
        res.json(dists);
    } catch (e) { res.status(500).json({error: 'Distribütörler okunamadı'}); }
});

router.get('/companies', requireLogin, async (req, res) => {
    try {
        const comps = await prisma.company.findMany({
            where: { tenantId: req.user.tenantId }
        });
        const receivables = await prisma.receivable.findMany({
            where: { tenantId: req.user.tenantId }
        });

        const combined = comps.map(c => {
            const rcv = receivables.find(r => r.code === c.cariKod);
            return { ...c, riskLimit: rcv ? rcv.riskLimit : 0 };
        });
        res.json(combined);
    } catch (e) { res.status(500).json({error: 'Kurumlar okunamadı'}); }
});

// --- XML UPLOAD ---

router.post('/admin/upload-products-xml', requireLogin, requirePermission('xml.manage'), csrfCheck, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Dosya seçilmedi' });
        const parsed = await xmlService.parseXmlFile(req.file.path);
        if (xmlService.validateProductXml(parsed)) {
            let prods = xmlService.getProducts(parsed);
            
            for (const p of prods) {
                await prisma.product.upsert({
                    where: { kod_tenantId: { kod: String(p.kod), tenantId: req.user.tenantId } },
                    update: {
                        ad: String(p.ad),
                        priceExclTax: parseFloat(p.fiyat) || 0
                    },
                    create: {
                        kod: String(p.kod),
                        ad: String(p.ad),
                        priceExclTax: parseFloat(p.fiyat) || 0,
                        tenantId: req.user.tenantId
                    }
                });
            }
            res.json({ message: 'Ürünler XML yüklendi ve veritabanına aktarıldı' });
        } else {
            res.status(400).json({ error: 'Geçersiz Ürün XML formatı' });
        }
    } catch (e) { 
        console.error('XML upload error:', e);
        res.status(500).json({ error: 'İşlem hatası: ' + e.message }); 
    } finally { 
        if(req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); 
    }
});

router.post('/admin/upload-companies-xml', requireLogin, requirePermission('xml.manage'), csrfCheck, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Dosya seçilmedi' });
        const parsed = await xmlService.parseXmlFile(req.file.path);
        if (xmlService.validateCompanyXml(parsed)) {
            let comps = xmlService.getCompanies(parsed);
            
            for (const c of comps) {
                await prisma.company.upsert({
                    where: { cariKod_tenantId: { cariKod: String(c.cariKod), tenantId: req.user.tenantId } },
                    update: { ad: String(c.ad) },
                    create: {
                        cariKod: String(c.cariKod),
                        ad: String(c.ad),
                        tenantId: req.user.tenantId
                    }
                });
            }
            res.json({ message: 'Kurumlar XML yüklendi ve aktarıldı' });
        } else {
            res.status(400).json({ error: 'Geçersiz Kurum XML formatı' });
        }
    } catch (e) { res.status(500).json({ error: 'İşlem hatası' }); } finally { if(req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); }
});

// --- CRUD: ÜRÜN ---

router.post('/admin/add-product', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        const { kod, ad, priceExclTax, taxRate } = req.body;
        
        const exists = await prisma.product.findUnique({
            where: { kod_tenantId: { kod, tenantId: req.user.tenantId } }
        });
        if (exists) return res.status(400).json({ error: 'Ürün kodu zaten mevcut' });
        
        await prisma.product.create({
            data: {
                kod,
                ad,
                priceExclTax: parseFloat(priceExclTax) || 0,
                taxRate: parseFloat(taxRate) || 20,
                tenantId: req.user.tenantId
            }
        });
        
        res.json({ message: 'Ürün eklendi' });
    } catch(e) { res.status(500).json({error: 'Hata oluştu'}); }
});

router.put('/admin/products/:code', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        await prisma.product.update({
            where: { kod_tenantId: { kod: req.params.code, tenantId: req.user.tenantId } },
            data: req.body
        });
        res.json({ message: 'Ürün güncellendi' });
    } catch(e) { res.status(500).json({error: 'Hata oluştu'}); }
});

router.delete('/admin/products/:code', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        await prisma.product.delete({
            where: { kod_tenantId: { kod: req.params.code, tenantId: req.user.tenantId } }
        });
        res.json({ message: 'Ürün silindi' });
    } catch(e) { res.status(500).json({error: 'Hata oluştu'}); }
});

router.post('/admin/products/bulk-delete', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        const { codes } = req.body;
        await prisma.product.deleteMany({
            where: {
                kod: { in: codes },
                tenantId: req.user.tenantId
            }
        });
        res.json({ message: 'Toplu silme başarılı' });
    } catch(e) { res.status(500).json({error: 'Hata oluştu'}); }
});

// --- CRUD: DİSTRİBÜTÖR (USER TABLOSU ÜZERİNDEN) ---
router.post('/admin/add-distributor', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        const { kod, ad, phone, email, password } = req.body;
        const lower = kod.toLowerCase();
        
        const exists = await prisma.user.findFirst({ where: { username: lower } });
        if (exists) return res.status(400).json({ error: 'Bu kullanıcı adı zaten mevcut' });

        const hash = await bcrypt.hash(password || '123456', 10);
        await prisma.user.create({
            data: {
                username: lower,
                displayName: ad,
                phone: phone,
                email: email,
                passwordHash: hash,
                role: 'distributor',
                tenantId: req.user.tenantId,
                isActive: true
            }
        });
        res.json({ message: 'Distribütör kullanıcı olarak eklendi' });
    } catch(e) { res.status(500).json({error: 'Hata: ' + e.message}); }
});

router.put('/admin/distributors/:code', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        await prisma.user.updateMany({
            where: { username: req.params.code, tenantId: req.user.tenantId, role: 'distributor' },
            data: { 
                displayName: req.body.ad,
                phone: req.body.phone,
                email: req.body.email
            }
        });
        res.json({ message: 'Distribütör güncellendi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.delete('/admin/distributors/:code', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        await prisma.user.deleteMany({
            where: { username: req.params.code, tenantId: req.user.tenantId, role: 'distributor' }
        });
        res.json({ message: 'Distribütör silindi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

// --- CRUD: KURUM ---
router.post('/admin/add-company', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        const { cariKod, ad, phone, email, discountRate, taxOffice, taxNumber, province, district, address, riskLimit } = req.body;
        
        const exists = await prisma.company.findUnique({
            where: { cariKod_tenantId: { cariKod, tenantId: req.user.tenantId } }
        });
        if (exists) return res.status(400).json({ error: 'Bu kod zaten mevcut' });
        
        await prisma.$transaction([
            prisma.company.create({
                data: {
                    cariKod, ad, phone, email, address, taxOffice, taxNumber, province, district,
                    discountRate: parseFloat(discountRate) || 0,
                    tenantId: req.user.tenantId
                }
            }),
            prisma.receivable.upsert({
                where: { code_tenantId: { code: cariKod, tenantId: req.user.tenantId } },
                update: {
                    companyName: ad,
                    riskLimit: parseFloat(riskLimit) || 0,
                    updatedAt: new Date()
                },
                create: {
                    code: cariKod,
                    companyName: ad,
                    balance: 0,
                    riskLimit: parseFloat(riskLimit) || 0,
                    status: 'AKTIF',
                    source: 'auto-company-add',
                    tenantId: req.user.tenantId
                }
            })
        ]);

        res.json({ message: 'Kurumsal Cari Kaydedildi' });
    } catch(e) { 
        console.error('Add company error:', e);
        res.status(500).json({error: 'Hata'}); 
    }
});

router.put('/admin/companies/:code', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        const { riskLimit, ad, province, district, ...otherUpdates } = req.body;
        
        await prisma.$transaction([
            prisma.company.update({
                where: { cariKod_tenantId: { cariKod: req.params.code, tenantId: req.user.tenantId } },
                data: { ad, province, district, ...otherUpdates }
            }),
            prisma.receivable.updateMany({
                where: { code: req.params.code, tenantId: req.user.tenantId },
                data: {
                    riskLimit: parseFloat(riskLimit) || 0,
                    companyName: ad,
                    updatedAt: new Date()
                }
            })
        ]);

        res.json({ message: 'Kurum güncellendi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.delete('/admin/companies/:code', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        await prisma.company.delete({
            where: { cariKod_tenantId: { cariKod: req.params.code, tenantId: req.user.tenantId } }
        });
        res.json({ message: 'Kurum silindi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});


// --- KULLANICI YÖNETİMİ ---

router.get('/admin/users', requireLogin, requirePermission('users.manage'), async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: { tenantId: req.user.tenantId },
            select: { id: true, username: true, displayName: true, role: true, permissions: true, isActive: true }
        });
        const safe = users.map(u => ({ 
            ...u, 
            permissions: typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions 
        }));
        res.json(safe);
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.post('/admin/users', requireLogin, requirePermission('users.manage'), csrfCheck, async (req, res) => {
    try {
        const { username, displayName, role, password, permissions, warehouseId } = req.body;
        const lower = username.toLowerCase();
        
        const exists = await prisma.user.findFirst({ where: { username: lower } });
        if (exists) return res.status(400).json({ error: 'Kullanıcı adı kullanımda' });
        
        const hash = await bcrypt.hash(password, 10);
        await prisma.user.create({
            data: {
                username: lower,
                displayName,
                role,
                tenantId: req.user.tenantId,
                passwordHash: hash,
                permissions: JSON.stringify(permissions || []),
                warehouseId: (role === 'warehouse' ? warehouseId : null),
                isActive: true
            }
        });
        
        res.json({ message: 'Kullanıcı eklendi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.post('/admin/users/:id/password', requireLogin, requirePermission('users.manage'), csrfCheck, async (req, res) => {
    try {
        const hash = await bcrypt.hash(req.body.password, 10);
        await prisma.user.update({
            where: { id: req.params.id, tenantId: req.user.tenantId },
            data: { passwordHash: hash, updatedAt: new Date() }
        });
        res.json({ message: 'Şifre sıfırlandı' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.post('/admin/users/:id/toggle', requireLogin, requirePermission('users.manage'), csrfCheck, async (req, res) => {
    try {
        if (req.params.id === req.user.id) return res.status(400).json({error: 'Kendi durumunuzu değiştiremezsiniz'});
        
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user || user.tenantId !== req.user.tenantId) return res.status(403).json({error: 'Yetkisiz erişim'});

        await prisma.user.update({
            where: { id: req.params.id },
            data: { isActive: !user.isActive, updatedAt: new Date() }
        });
        res.json({ message: 'Durum değiştirildi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.delete('/admin/users/:id', requireLogin, requirePermission('users.manage'), csrfCheck, async (req, res) => {
    try {
        if (req.params.id === req.user.id) return res.status(400).json({error: 'Kendinizi silemezsiniz'});
        
        await prisma.user.delete({
            where: { id: req.params.id, tenantId: req.user.tenantId }
        });
        res.json({ message: 'Kullanıcı silindi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

// --- YEDEKLEME SİSTEMİ ---
router.get('/admin/backup', requireRole('admin'), async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const ts = Date.now();
        const tenantDataDir = path.join(dataAccess.dataDir, tenantId);
        const backupDir = path.join(tenantDataDir, 'backups', `${ts}_manual`);
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        
        const files = ['orders.json', 'products.json', 'distributors.json', 'companies.json', 'warehouses.json'];
        files.forEach(f => {
            const source = path.join(tenantDataDir, f);
            if (fs.existsSync(source)) {
                fs.copyFileSync(source, path.join(backupDir, f));
            }
        });

        await dataAccess.appendAuditLog({ 
            ts: new Date().toISOString(), 
            userId: req.user.id, 
            username: req.user.username, 
            role: req.user.role, 
            action: 'BACKUP_CREATED', 
            entityType: 'system', 
            entityId: 'backup', 
            details: { type: 'manual' } 
        }, tenantId);
        res.json({ message: 'Dükkan yedeği başarıyla oluşturuldu.' });
    } catch(e) {
        res.status(500).json({ error: 'Yedekleme sırasında hata oluştu.' });
    }
});

// --- EXPORT: EXCEL ---

router.get('/admin/export/products', requireLogin, requireRole('admin'), async (req, res) => {
    try {
        const prods = await prisma.product.findMany({
            where: { tenantId: req.user.tenantId }
        });
        const columns = [
            { header: 'Ürün Kodu', key: 'kod', width: 20 },
            { header: 'Ürün Adı', key: 'ad', width: 40 },
            { header: 'Fiyat (KDV Hariç)', key: 'priceExclTax', width: 20 },
            { header: 'KDV Oranı (%)', key: 'taxRate', width: 15 }
        ];
        const buffer = await excelService.generateExcel(prods, columns, 'Ürün Listesi');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=urunler.xlsx');
        res.send(buffer);
    } catch(e) { res.status(500).json({ error: 'Excel oluşturulamadı' }); }
});

router.get('/admin/export/orders', requireLogin, requireRole('admin'), async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            where: { tenantId: req.user.tenantId },
            include: { items: true }
        });
        const companies = await prisma.company.findMany({
            where: { tenantId: req.user.tenantId }
        });

        const rows = orders.map(o => {
            const company = companies.find(c => c.cariKod === o.companyCode) || {};
            let cargoStr = '-';
            if (o.cargoDetail) {
                try {
                    const cd = JSON.parse(o.cargoDetail);
                    cargoStr = `${cd.company} (${cd.trackingCode})`;
                } catch(err) {}
            }
            
            return {
                date: new Date(o.createdAt).toLocaleString('tr-TR'),
                creator: o.distributorCode || '-',
                receiver: o.companyCode || '-',
                amount: o.finalAmount ? o.finalAmount.toLocaleString('tr-TR') + ' TL' : '0 TL',
                status: `${o.status} ${o.status === 'KARGODA' ? '/ ' + cargoStr : ''}`,
                address: company.address || '-',
                notes: o.notes || '-'
            };
        });

        const columns = [
            { header: 'Sipariş Tarihi', key: 'date', width: 25 },
            { header: 'Oluşturan (Distribütör)', key: 'creator', width: 25 },
            { header: 'Alıcı Kurum (Müşteri)', key: 'receiver', width: 25 },
            { header: 'Toplam Tutar', key: 'amount', width: 20 },
            { header: 'Durum / Kargo Bilgisi', key: 'status', width: 35 },
            { header: 'Sevk Adresi', key: 'address', width: 40 },
            { header: 'Sipariş Notu', key: 'notes', width: 30 }
        ];

        const buffer = await excelService.generateExcel(rows, columns, 'Detaylı Sipariş Raporu');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=detayli_siparisler.xlsx');
        res.send(buffer);
    } catch(e) { 
        res.status(500).json({ error: 'Excel oluşturulamadı' }); 
    }
});

router.get('/admin/export/companies', requireLogin, requireRole('admin'), async (req, res) => {
    try {
        const comps = await prisma.company.findMany({
            where: { tenantId: req.user.tenantId }
        });
        const columns = [
            { header: 'Cari Kod', key: 'cariKod', width: 20 },
            { header: 'Kurum Adı', key: 'ad', width: 40 },
            { header: 'Telefon', key: 'phone', width: 20 },
            { header: 'E-Posta', key: 'email', width: 30 },
            { header: 'Adres', key: 'address', width: 40 },
            { header: 'İskonto %', key: 'discountRate', width: 15 }
        ];
        const buffer = await excelService.generateExcel(comps, columns, 'Cari Listesi');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=cariler.xlsx');
        res.send(buffer);
    } catch(e) { res.status(500).json({ error: 'Excel oluşturulamadı' }); }
});

router.get('/admin/subscription-status', requireLogin, async (req, res) => {
    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: req.user.tenantId }
        });
        if (!tenant) return res.status(404).json({ error: 'Mağaza bulunamadı' });
        
        res.json({
            status: tenant.status,
            plan: tenant.plan,
            expiry: tenant.subscriptionExpiry,
            name: tenant.name
        });
    } catch (e) { res.status(500).json({ error: 'Bilgiler alınamadı' }); }
});

// --- TENANT SETTINGS ---
router.get('/admin/settings', requireLogin, requireRole('admin'), async (req, res) => {
    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: req.user.tenantId }
        });
        if (!tenant) return res.status(404).json({ error: 'Mağaza bulunamadı' });
        
        const settings = typeof tenant.settings === 'string' ? JSON.parse(tenant.settings) : (tenant.settings || {});
        res.json({
            name: tenant.name,
            officialName: tenant.officialName,
            address: tenant.address,
            phone: tenant.phone,
            taxOffice: tenant.taxOffice,
            taxNumber: tenant.taxNumber,
            settings: settings
        });
    } catch (e) { res.status(500).json({ error: 'Bilgiler alınamadı' }); }
});

router.put('/admin/settings', requireLogin, requireRole('admin'), csrfCheck, async (req, res) => {
    try {
        const { officialName, address, phone, taxOffice, taxNumber, settings } = req.body;
        
        await prisma.tenant.update({
            where: { id: req.user.tenantId },
            data: {
                officialName,
                address,
                phone,
                taxOffice,
                taxNumber,
                settings: JSON.stringify(settings || {})
            }
        });
        
        res.json({ message: 'Mağaza ayarları güncellendi' });
    } catch (e) { 
        console.error('Settings update error:', e);
        res.status(500).json({ error: 'Ayarlar kaydedilemedi' }); 
    }
});

module.exports = router;
