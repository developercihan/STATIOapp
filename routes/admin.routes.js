const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
let sharp;
try { sharp = require('sharp'); } catch(e) { sharp = null; console.warn('sharp yüklenemedi (Vercel ortamı)'); }
const bcrypt = require('bcryptjs');
const dataAccess = require('../services/dataAccess');
const xmlService = require('../services/xml.service');
const excelService = require('../services/excel.service');
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
        let products = await dataAccess.readJson('products.json', req.user.tenantId);
        
        if (req.query.search) {
            const s = req.query.search.toLowerCase();
            products = products.filter(p => 
                (p.kod && p.kod.toString().toLowerCase().includes(s)) ||
                (p.ad && p.ad.toString().toLowerCase().includes(s))
            );
        }
        res.json(products);
    } catch(e) { res.status(500).json({error: 'Ürünler okunamadı'}); }
});

// POST /api/admin/products/:code/image
router.post('/admin/products/:code/image', requireLogin, requireRole('admin'), csrfCheck, imageUpload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Resim dosyası yüklenmedi' });
        
        const { code } = req.params;
        const tenantId = req.user.tenantId;
        const uploadDir = path.join(dataAccess.dataDir, tenantId, 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        
        const fileName = `${code}.webp`;
        const filePath = path.join(uploadDir, fileName);
        
        await sharp(req.file.buffer)
            .resize(800, 800, { 
                fit: 'contain', 
                background: { r: 0, g: 0, b: 0, alpha: 0 } 
            })
            .webp({ quality: 85 })
            .toFile(filePath);
            
        // Update product data with image path
        const products = await dataAccess.readJson('products.json', tenantId);
        const idx = products.findIndex(p => p.kod === code);
        if (idx !== -1) {
            products[idx].image = `/uploads/${fileName}`; // server.js dynamically resolves this via session
            await dataAccess.writeJson('products.json', products, tenantId);
        }
        
        res.json({ message: 'Resim yüklendi', path: `/uploads/${fileName}` });
    } catch (e) {
        console.error('Image upload error:', e);
        res.status(500).json({ error: 'Resim işlenirken hata oluştu' });
    }
});

router.get('/distributors', requireLogin, async (req, res) => {
    try {
        let dists = await dataAccess.readJson('distributors.json', req.user.tenantId);
        res.json(dists);
    } catch (e) { res.status(500).json({error: 'Distribütörler okunamadı'}); }
});

router.get('/companies', requireLogin, async (req, res) => {
    try {
        const [companies, receivables] = await Promise.all([
            dataAccess.readJson('companies.json', req.user.tenantId),
            dataAccess.readJson('receivables.json', req.user.tenantId)
        ]);
        const combined = companies.map(c => {
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
            let prods = xmlService.getProducts(parsed).map(p => ({
                kod: String(p.kod),
                ad: String(p.ad),
                priceExclTax: parseFloat(p.fiyat) || 0,
                taxRate: 20
            }));
            await dataAccess.writeJson('products.json', prods, req.user.tenantId);
            res.json({ message: 'Ürünler XML yüklendi ve aktarıldı' });
        } else {
            res.status(400).json({ error: 'Geçersiz Ürün XML formatı' });
        }
    } catch (e) { res.status(500).json({ error: 'İşlem hatası: ' + e.message }); } finally { if(req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); }
});

router.post('/admin/upload-distributors-xml', requireLogin, requirePermission('xml.manage'), csrfCheck, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Dosya seçilmedi' });
        const parsed = await xmlService.parseXmlFile(req.file.path);
        if (xmlService.validateDistributorXml(parsed)) {
            let dists = xmlService.getDistributors(parsed).map(d => ({
                kod: String(d.kod),
                ad: String(d.ad),
                phone: '',
                email: ''
            }));
            await dataAccess.writeJson('distributors.json', dists, req.user.tenantId);
            res.json({ message: 'Distribütörler XML yüklendi ve aktarıldı' });
        } else {
            res.status(400).json({ error: 'Geçersiz Distribütör XML formatı' });
        }
    } catch (e) { res.status(500).json({ error: 'İşlem hatası' }); } finally { if(req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); }
});

router.post('/admin/upload-companies-xml', requireLogin, requirePermission('xml.manage'), csrfCheck, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Dosya seçilmedi' });
        const parsed = await xmlService.parseXmlFile(req.file.path);
        if (xmlService.validateCompanyXml(parsed)) {
            let comps = xmlService.getCompanies(parsed).map(c => ({
                cariKod: String(c.cariKod),
                ad: String(c.ad),
                phone: '',
                email: '',
                discountRate: 0
            }));
            await dataAccess.writeJson('companies.json', comps, req.user.tenantId);
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
        let prods = await dataAccess.readJson('products.json', req.user.tenantId);
        
        if (prods.find(p => p.kod === kod)) return res.status(400).json({ error: 'Kod zaten mevcut' });
        
        prods.push({ kod, ad, priceExclTax: parseFloat(priceExclTax) || 0, taxRate: parseFloat(taxRate) || 20 });
        
        await dataAccess.writeJson('products.json', prods, req.user.tenantId);
        res.json({ message: 'Ürün eklendi' });
    } catch(e) { res.status(500).json({error: 'Hata oluştu'}); }
});

router.put('/admin/products/:code', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        let prods = await dataAccess.readJson('products.json', req.user.tenantId);
        const idx = prods.findIndex(p => String(p.kod) === String(req.params.code));
        
        if (idx === -1) return res.status(404).json({ error: 'Ürün bulunamadı' });
        
        prods[idx] = { ...prods[idx], ...req.body };
        await dataAccess.writeJson('products.json', prods, req.user.tenantId);
        res.json({ message: 'Ürün güncellendi' });
    } catch(e) { res.status(500).json({error: 'Hata oluştu'}); }
});

router.delete('/admin/products/:code', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        let prods = await dataAccess.readJson('products.json', req.user.tenantId);
        const code = req.params.code;
        const filtered = prods.filter(p => String(p.kod) !== String(code));
        
        if (filtered.length === prods.length) return res.status(404).json({ error: 'Bulunamadı' });
        
        await dataAccess.writeJson('products.json', filtered, req.user.tenantId);
        res.json({ message: 'Ürün silindi' });
    } catch(e) { res.status(500).json({error: 'Hata oluştu'}); }
});

router.post('/admin/products/bulk-delete', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        const { codes } = req.body;
        let prods = await dataAccess.readJson('products.json', req.user.tenantId);
        const filtered = prods.filter(p => !codes.includes(String(p.kod)));
        await dataAccess.writeJson('products.json', filtered, req.user.tenantId);
        res.json({ message: 'Toplu silme başarılı' });
    } catch(e) { res.status(500).json({error: 'Hata oluştu'}); }
});

// --- CRUD: DİSTRİBÜTÖR ---
router.post('/admin/add-distributor', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        const { kod, ad, phone, email } = req.body;
        let dists = await dataAccess.readJson('distributors.json', req.user.tenantId);
        if (dists.find(d => d.kod === kod)) return res.status(400).json({ error: 'Bu kod zaten mevcut' });
        dists.push({ kod, ad, phone: phone || '', email: email || '' });
        await dataAccess.writeJson('distributors.json', dists, req.user.tenantId);
        res.json({ message: 'Distribütör eklendi' });
    } catch(e) { res.status(500).json({error: 'Hata: ' + e.message}); }
});

router.put('/admin/distributors/:code', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        let dists = await dataAccess.readJson('distributors.json', req.user.tenantId);
        const idx = dists.findIndex(d => String(d.kod) === String(req.params.code));
        if (idx === -1) return res.status(404).json({ error: 'Distribütör bulunamadı' });
        dists[idx] = { ...dists[idx], ...req.body };
        await dataAccess.writeJson('distributors.json', dists, req.user.tenantId);
        res.json({ message: 'Distribütör güncellendi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.delete('/admin/distributors/:code', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        let dists = await dataAccess.readJson('distributors.json', req.user.tenantId);
        const filtered = dists.filter(d => String(d.kod) !== String(req.params.code));
        await dataAccess.writeJson('distributors.json', filtered, req.user.tenantId);
        res.json({ message: 'Distribütör silindi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

// --- CRUD: KURUM ---
router.post('/admin/add-company', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        const { cariKod, ad, phone, email, discountRate, taxOffice, taxNumber, address, riskLimit } = req.body;
        let comps = await dataAccess.readJson('companies.json', req.user.tenantId);
        if (comps.find(c => c.cariKod === cariKod)) return res.status(400).json({ error: 'Bu kod zaten mevcut' });
        
        comps.push({ 
            cariKod, 
            ad, 
            phone: phone || '', 
            email: email || '', 
            discountRate: parseFloat(discountRate) || 0,
            taxOffice: taxOffice || '',
            taxNumber: taxNumber || '',
            address: address || ''
        });
        
        await dataAccess.writeJson('companies.json', comps, req.user.tenantId);

        // Cari finansal kaydını da oluştur/güncelle
        const receivables = await dataAccess.readJson('receivables.json', req.user.tenantId);
        let rIdx = receivables.findIndex(r => r.code === cariKod);
        if (rIdx === -1) {
            receivables.push({
                id: makeId('rcv'),
                code: cariKod,
                companyName: ad, // Cari kodu değil, gerçek firma adı
                balance: 0,
                riskLimit: parseFloat(riskLimit) || 0,
                status: 'AKTIF',
                source: 'auto-company-add',
                transactions: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        } else {
            receivables[rIdx].riskLimit = parseFloat(riskLimit) || 0;
            receivables[rIdx].updatedAt = new Date().toISOString();
        }
        await dataAccess.writeJson('receivables.json', receivables, req.user.tenantId);

        res.json({ message: 'Kurumsal Cari Kaydedildi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.put('/admin/companies/:code', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        const { riskLimit, ad, ...otherUpdates } = req.body;
        let comps = await dataAccess.readJson('companies.json', req.user.tenantId);
        const idx = comps.findIndex(c => String(c.cariKod) === String(req.params.code));
        if (idx === -1) return res.status(404).json({ error: 'Kurum bulunamadı' });
        
        comps[idx] = { ...comps[idx], ad, ...otherUpdates };
        await dataAccess.writeJson('companies.json', comps, req.user.tenantId);

        // Cari tablosundaki risk limitini ve şirket adını da güncelle
        const receivables = await dataAccess.readJson('receivables.json', req.user.tenantId);
        const rIdx = receivables.findIndex(r => r.code === req.params.code);
        if (rIdx !== -1) {
            receivables[rIdx].riskLimit = parseFloat(riskLimit) || 0;
            receivables[rIdx].companyName = ad; // İsim senkronizasyonu
            receivables[rIdx].updatedAt = new Date().toISOString();
            await dataAccess.writeJson('receivables.json', receivables, req.user.tenantId);
        }

        res.json({ message: 'Kurum güncellendi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.delete('/admin/companies/:code', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        let comps = await dataAccess.readJson('companies.json', req.user.tenantId);
        const filtered = comps.filter(c => String(c.cariKod) !== String(req.params.code));
        await dataAccess.writeJson('companies.json', filtered, req.user.tenantId);
        res.json({ message: 'Kurum silindi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});


// --- KULLANICI YÖNETİMİ ---

router.get('/admin/users', requireLogin, requirePermission('users.manage'), async (req, res) => {
    try {
        const users = await dataAccess.readJson('users.json');
        // Kendi tenant'ındakileri görsün
        const tenantUsers = users.filter(u => u.tenantId === req.user.tenantId);
        const safe = tenantUsers.map(u => ({ id: u.id, username: u.username, displayName: u.displayName, role: u.role, permissions: u.permissions, isActive: u.isActive }));
        res.json(safe);
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.post('/admin/users', requireLogin, requirePermission('users.manage'), csrfCheck, async (req, res) => {
    try {
        const { username, displayName, role, password, permissions, warehouseId } = req.body;
        const users = await dataAccess.readJson('users.json');
        const lower = username.toLowerCase();
        
        if (users.find(u => u.username === lower)) return res.status(400).json({ error: 'Kullanıcı adı kullanımda' });
        
        const hash = await bcrypt.hash(password, 10);
        const newUser = {
            id: makeId('u'),
            username: lower,
            displayName,
            role,
            tenantId: req.user.tenantId, // Admin kendi tenant'ına ekleme yapar
            passwordHash: hash,
            permissions: permissions || [],
            warehouseId: (role === 'warehouse' ? warehouseId : null),
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        users.push(newUser);
        await dataAccess.writeJson('users.json', users);
        res.json({ message: 'Kullanıcı eklendi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.post('/admin/users/:id/password', requireLogin, requirePermission('users.manage'), csrfCheck, async (req, res) => {
    try {
        const users = await dataAccess.readJson('users.json');
        const user = users.find(u => u.id === req.params.id);
        if (!user || user.tenantId !== req.user.tenantId) return res.status(403).json({error: 'Yetkisiz erişim'});
        
        const idx = users.findIndex(u => u.id === req.params.id);
        users[idx].passwordHash = await bcrypt.hash(req.body.password, 10);
        users[idx].updatedAt = new Date().toISOString();
        
        await dataAccess.writeJson('users.json', users);
        res.json({ message: 'Şifre sıfırlandı' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.post('/admin/users/:id/toggle', requireLogin, requirePermission('users.manage'), csrfCheck, async (req, res) => {
    try {
        if (req.params.id === req.user.id) return res.status(400).json({error: 'Kendi durumunuzu değiştiremezsiniz'});
        const users = await dataAccess.readJson('users.json');
        const user = users.find(u => u.id === req.params.id);
        if (!user || user.tenantId !== req.user.tenantId) return res.status(403).json({error: 'Yetkisiz erişim'});

        const idx = users.findIndex(u => u.id === req.params.id);
        users[idx].isActive = !users[idx].isActive;
        users[idx].updatedAt = new Date().toISOString();
        
        await dataAccess.writeJson('users.json', users);
        res.json({ message: 'Durum değiştirildi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.delete('/admin/users/:id', requireLogin, requirePermission('users.manage'), csrfCheck, async (req, res) => {
    try {
        if (req.params.id === req.user.id) return res.status(400).json({error: 'Kendinizi silemezsiniz'});
        const users = await dataAccess.readJson('users.json');
        const user = users.find(u => u.id === req.params.id);
        if (!user || user.tenantId !== req.user.tenantId) return res.status(403).json({error: 'Yetkisiz erişim'});

        const filtered = users.filter(u => u.id !== req.params.id);
        await dataAccess.writeJson('users.json', filtered);
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
        const prods = await dataAccess.readJson('products.json', req.user.tenantId);
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
        const [orders, companies] = await Promise.all([
            dataAccess.readJson('orders.json', req.user.tenantId),
            dataAccess.readJson('companies.json', req.user.tenantId)
        ]);

        const rows = [];
        orders.forEach(o => {
            const company = companies.find(c => c.cariKod === o.companyCode) || {};
            const cargoInfo = o.cargoDetail ? `${o.cargoDetail.company} (${o.cargoDetail.trackingCode})` : '-';
            
            rows.push({
                date: new Date(o.createdAt).toLocaleString('tr-TR'),
                creator: o.distributorCode || '-',
                receiver: o.companyCode || '-',
                amount: o.finalAmount ? o.finalAmount.toLocaleString('tr-TR') + ' TL' : '0 TL',
                status: `${o.status} ${o.status === 'KARGODA' ? '/ ' + cargoInfo : ''}`,
                address: company.address || '-',
                notes: o.notes || '-'
            });
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
        const comps = await dataAccess.readJson('companies.json', req.user.tenantId);
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
        const tenants = await dataAccess.readJson('tenants.json');
        const tenant = tenants.find(t => t.id === req.user.tenantId);
        if (!tenant) return res.status(404).json({ error: 'Mağaza bulunamadı' });
        
        res.json({
            status: tenant.status,
            plan: tenant.plan,
            expiry: tenant.subscriptionExpiry,
            name: tenant.name
        });
    } catch (e) { res.status(500).json({ error: 'Bilgiler alınamadı' }); }
});

module.exports = router;
