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
// Not: GET /api/products, /api/distributors, /api/companies endpointleri data.routes.js'te tanımlıdır.

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

// --- XML UPLOAD ---

router.post('/admin/upload-products-xml', requireLogin, requirePermission('xml.manage'), csrfCheck, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Dosya seçilmedi' });
        const parsed = await xmlService.parseXmlFile(req.file.path);
        if (xmlService.validateProductXml(parsed)) {
            let prods = xmlService.getProducts(parsed);
            
            // Plan limit kontrolü
            const currentCount = await prisma.product.count({ where: { tenantId: req.user.tenantId } });
            const maxAllowed = req.user.planLimit?.maxProducts || 500;
            if (currentCount + prods.length > maxAllowed) {
                if(req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                return res.status(403).json({ 
                    error: `Plan limitinize ulaştınız. Mevcut: ${currentCount}, Eklenecek: ${prods.length}, Limit: ${maxAllowed}. Lütfen paketinizi yükseltin.`,
                    code: 'PLAN_LIMIT_EXCEEDED'
                });
            }
            
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
router.post('/admin/add-product', requireLogin, requirePermission('products.manage'), csrfCheck, async (req, res) => {
    try {
        const { kod, ad, priceExclTax, taxRate, stock, image, barcode, unit, category, brand, description, visibility, channel } = req.body;
        
        const currentCount = await prisma.product.count({ where: { tenantId: req.user.tenantId } });
        const maxAllowed = req.user.planLimit?.maxProducts || 500;
        if (currentCount >= maxAllowed) {
            return res.status(403).json({ error: 'Ürün limitinize ulaştınız', code: 'PLAN_LIMIT_EXCEEDED' });
        }
        
        const exists = await prisma.product.findUnique({
            where: { kod_tenantId: { kod, tenantId: req.user.tenantId } }
        });
        if (exists) return res.status(400).json({ error: 'Bu kod zaten mevcut' });

        await prisma.product.create({
            data: {
                kod, ad, 
                priceExclTax: parseFloat(priceExclTax) || 0,
                taxRate: parseFloat(taxRate) || 20,
                stock: parseFloat(stock) || 0,
                image, barcode, 
                unit: unit || 'Adet',
                category, brand, description, 
                visibility: visibility || 'B2B_ONLY',
                channel,
                discountRate: parseFloat(req.body.discountRate) || 0,
                tenantId: req.user.tenantId
            }
        });
        res.json({ message: 'Ürün eklendi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.put('/admin/products/:kod', requireLogin, requirePermission('products.manage'), csrfCheck, async (req, res) => {
    try {
        const { ad, priceExclTax, taxRate, stock, image, barcode, unit, category, brand, description, visibility, channel } = req.body;
        await prisma.product.update({
            where: { kod_tenantId: { kod: req.params.kod, tenantId: req.user.tenantId } },
            data: {
                ad, 
                priceExclTax: parseFloat(priceExclTax) || 0,
                taxRate: parseFloat(taxRate) || 20,
                stock: parseFloat(stock) || 0,
                image, barcode, 
                unit: unit || 'Adet',
                category, brand, description, 
                visibility: visibility || 'B2B_ONLY',
                channel,
                discountRate: parseFloat(req.body.discountRate) || 0,
                updatedAt: new Date()
            }
        });
        res.json({ message: 'Ürün güncellendi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.delete('/admin/products/:code', requireLogin, requirePermission('products.manage'), csrfCheck, async (req, res) => {
    try {
        await prisma.product.delete({
            where: { kod_tenantId: { kod: req.params.code, tenantId: req.user.tenantId } }
        });
        res.json({ message: 'Ürün silindi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

// --- CRUD: KURUM ---
router.post('/admin/add-company', requireLogin, requirePermission('companies.manage'), csrfCheck, async (req, res) => {
    try {
        const { cariKod, ad, phone, email, discountRate, taxOffice, taxNumber, province, district, address, riskLimit, b2bUser, b2bPass, salesRepId } = req.body;
        
        const exists = await prisma.company.findUnique({
            where: { cariKod_tenantId: { cariKod, tenantId: req.user.tenantId } }
        });
        if (exists) return res.status(400).json({ error: 'Bu kod zaten mevcut' });

        const operations = [
            prisma.company.create({
                data: {
                    cariKod, ad, phone, email, address, taxOffice, taxNumber, province, district,
                    discountRate: parseFloat(discountRate) || 0,
                    riskLimit: parseFloat(riskLimit) || 0,
                    salesRepId: salesRepId || null,
                    b2bUser: b2bUser || null,
                    b2bPass: b2bPass || null,
                    tenantId: req.user.tenantId
                }
            }),
            prisma.receivable.upsert({
                where: { code_tenantId: { code: cariKod, tenantId: req.user.tenantId } },
                update: { companyName: ad, riskLimit: parseFloat(riskLimit) || 0, updatedAt: new Date() },
                create: { code: cariKod, companyName: ad, balance: 0, riskLimit: parseFloat(riskLimit) || 0, status: 'AKTIF', source: 'auto-company-add', tenantId: req.user.tenantId }
            })
        ];

        if (b2bUser && b2bPass) {
            const passwordHash = await bcrypt.hash(b2bPass, 10);
            operations.push(prisma.user.create({
                data: {
                    username: b2bUser, passwordHash, displayName: ad, role: 'distributor',
                    companyCode: cariKod, tenantId: req.user.tenantId
                }
            }));
        }
        
        await prisma.$transaction(operations);
        res.json({ message: 'Cari ve B2B Girişi Oluşturuldu' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.put('/admin/companies/:code', requireLogin, requirePermission('companies.manage'), csrfCheck, async (req, res) => {
    try {
        const { ad, phone, email, discountRate, taxOffice, taxNumber, province, district, address, riskLimit, b2bUser, b2bPass, salesRepId } = req.body;
        
        const operations = [
            prisma.company.update({
                where: { cariKod_tenantId: { cariKod: req.params.code, tenantId: req.user.tenantId } },
                data: {
                    ad, phone, email, address, taxOffice, taxNumber, province, district,
                    discountRate: parseFloat(discountRate) || 0,
                    riskLimit: parseFloat(riskLimit) || 0,
                    salesRepId: salesRepId || null,
                    b2bUser: b2bUser || null,
                    b2bPass: b2bPass || null,
                    updatedAt: new Date()
                }
            }),
            prisma.receivable.update({
                where: { code_tenantId: { code: req.params.code, tenantId: req.user.tenantId } },
                data: { companyName: ad, riskLimit: parseFloat(riskLimit) || 0, updatedAt: new Date() }
            })
        ];

        if (b2bUser && b2bPass) {
            const passwordHash = await bcrypt.hash(b2bPass, 10);
            const user = await prisma.user.findFirst({ where: { companyCode: req.params.code, tenantId: req.user.tenantId } });
            if (user) {
                operations.push(prisma.user.update({ where: { id: user.id }, data: { username: b2bUser, passwordHash, displayName: ad } }));
            } else {
                operations.push(prisma.user.create({ data: { username: b2bUser, passwordHash, displayName: ad, role: 'distributor', companyCode: req.params.code, tenantId: req.user.tenantId } }));
            }
        }

        await prisma.$transaction(operations);
        res.json({ message: 'Cari güncellendi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.delete('/admin/companies/:code', requireLogin, requirePermission('companies.manage'), csrfCheck, async (req, res) => {
    try {
        await prisma.company.delete({ where: { cariKod_tenantId: { cariKod: req.params.code, tenantId: req.user.tenantId } } });
        res.json({ message: 'Kurum silindi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

// --- BANNER UPLOAD ---
router.post('/admin/banners/upload', requireLogin, requireRole('admin'), csrfCheck, cloudinaryUpload.single('banner'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Resim yüklenmedi' });
        res.json({ url: req.file.path });
    } catch (e) { res.status(500).json({ error: 'Yükleme hatası' }); }
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
        const dbPath = path.join(__dirname, '..', 'data', 'statio.db');
        const backupDir = path.join(__dirname, '..', 'data', 'backups');
        
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        
        const backupFile = path.join(backupDir, `statio_backup_${ts}.db`);
        
        if (fs.existsSync(dbPath)) {
            fs.copyFileSync(dbPath, backupFile);
        } else {
            return res.status(500).json({ error: 'Veritabanı dosyası bulunamadı' });
        }

        await prisma.auditLog.create({
            data: {
                userId: req.user.id,
                username: req.user.username,
                role: req.user.role,
                action: 'BACKUP_CREATED',
                entityType: 'system',
                entityId: 'backup',
                tenantId: tenantId,
                details: JSON.stringify({ type: 'manual', file: `statio_backup_${ts}.db` })
            }
        });

        res.json({ message: 'Veritabanı yedeği başarıyla oluşturuldu.' });
    } catch(e) {
        console.error('Backup error:', e);
        res.status(500).json({ error: 'Yedekleme sırasında hata oluştu.' });
    }
});

// --- SYSTEM SETTINGS (WHITE LABEL) ---
router.get('/admin/settings', requireLogin, requireRole('admin'), async (req, res) => {
    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: req.user.tenantId }
        });
        if (!tenant) return res.status(404).json({ error: 'Mağaza bulunamadı' });
        
        const settings = typeof tenant.settings === 'string' ? JSON.parse(tenant.settings) : (tenant.settings || {});
        res.json({
            name: tenant.name,
            brandName: tenant.brandName,
            logoUrl: tenant.logoUrl,
            primaryColor: tenant.primaryColor,
            secondaryColor: tenant.secondaryColor,
            accentColor: tenant.accentColor,
            banners: tenant.banners,
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
        const { officialName, address, phone, taxOffice, taxNumber, settings, brandName, primaryColor, secondaryColor, accentColor, banners, logoUrl } = req.body;
        
        await prisma.tenant.update({
            where: { id: req.user.tenantId },
            data: {
                officialName,
                address,
                phone,
                taxOffice,
                taxNumber,
                brandName,
                logoUrl,
                primaryColor,
                secondaryColor,
                accentColor,
                banners: typeof banners === 'string' ? banners : JSON.stringify(banners || []),
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
