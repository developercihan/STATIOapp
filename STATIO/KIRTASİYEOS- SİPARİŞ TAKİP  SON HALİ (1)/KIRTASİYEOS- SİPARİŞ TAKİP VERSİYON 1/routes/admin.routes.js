const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const bcrypt = require('bcryptjs');
const dataAccess = require('../services/dataAccess');
const xmlService = require('../services/xml.service');
const { requireLogin, requirePermission, requireRole, csrfCheck, hasPermission } = require('../middlewares/auth.middleware');
const { makeId, ensureArray } = require('../utils/helpers');

const upload = multer({ dest: path.join(__dirname, '..', 'tmp') });
const imageUpload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const productsPath = path.join(dataAccess.dataDir, 'products.json');
const distsPath = path.join(dataAccess.dataDir, 'distributors.json');
const compPath = path.join(dataAccess.dataDir, 'companies.json');
const usersPath = path.join(dataAccess.dataDir, 'users.json');

// --- GENEL VERİ LİSTELEME ---

router.get('/products', requireLogin, async (req, res) => {
    try {
        let products = await dataAccess.readJson(productsPath);
        
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
        const uploadDir = path.join(dataAccess.dataDir, 'uploads');
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
        const products = await dataAccess.readJson(productsPath);
        const idx = products.findIndex(p => p.kod === code);
        if (idx !== -1) {
            products[idx].image = `/uploads/${fileName}`;
            await dataAccess.writeJson(productsPath, products);
        }
        
        res.json({ message: 'Resim yüklendi', path: `/uploads/${fileName}` });
    } catch (e) {
        console.error('Image upload error:', e);
        res.status(500).json({ error: 'Resim işlenirken hata oluştu' });
    }
});

router.get('/distributors', requireLogin, async (req, res) => {
    try {
        let dists = await dataAccess.readJson(distsPath);
        res.json(dists);
    } catch (e) { res.status(500).json({error: 'Distribütörler okunamadı'}); }
});

router.get('/companies', requireLogin, async (req, res) => {
    try {
        let companies = await dataAccess.readJson(compPath);
        res.json(companies);
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
            await dataAccess.writeJson(productsPath, prods);
            res.json({ message: 'Ürünler XML yüklendi ve aktarıldı' });
        } else {
            res.status(400).json({ error: 'Geçersiz Ürün XML formatı' });
        }
    } catch (e) { res.status(500).json({ error: 'İşlem hatası: ' + e.message }); } finally { if(req.file) fs.unlinkSync(req.file.path); }
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
            await dataAccess.writeJson(distsPath, dists);
            res.json({ message: 'Distribütörler XML yüklendi ve aktarıldı' });
        } else {
            res.status(400).json({ error: 'Geçersiz Distribütör XML formatı' });
        }
    } catch (e) { res.status(500).json({ error: 'İşlem hatası' }); } finally { if(req.file) fs.unlinkSync(req.file.path); }
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
            await dataAccess.writeJson(compPath, comps);
            res.json({ message: 'Kurumlar XML yüklendi ve aktarıldı' });
        } else {
            res.status(400).json({ error: 'Geçersiz Kurum XML formatı' });
        }
    } catch (e) { res.status(500).json({ error: 'İşlem hatası' }); } finally { if(req.file) fs.unlinkSync(req.file.path); }
});

// --- CRUD: ÜRÜN ---

router.post('/admin/add-product', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        const { kod, ad, priceExclTax, taxRate } = req.body;
        let prods = await dataAccess.readJson(productsPath);
        
        if (prods.find(p => p.kod === kod)) return res.status(400).json({ error: 'Kod zaten mevcut' });
        
        prods.push({ kod, ad, priceExclTax: parseFloat(priceExclTax) || 0, taxRate: parseFloat(taxRate) || 20 });
        
        await dataAccess.writeJson(productsPath, prods);
        res.json({ message: 'Ürün eklendi' });
    } catch(e) { res.status(500).json({error: 'Hata oluştu'}); }
});

router.put('/admin/products/:code', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        let prods = await dataAccess.readJson(productsPath);
        const idx = prods.findIndex(p => String(p.kod) === String(req.params.code));
        
        if (idx === -1) return res.status(404).json({ error: 'Ürün bulunamadı' });
        
        prods[idx] = { ...prods[idx], ...req.body };
        await dataAccess.writeJson(productsPath, prods);
        res.json({ message: 'Ürün güncellendi' });
    } catch(e) { res.status(500).json({error: 'Hata oluştu'}); }
});

router.delete('/admin/products/:code', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        let prods = await dataAccess.readJson(productsPath);
        const code = req.params.code;
        const filtered = prods.filter(p => String(p.kod) !== String(code));
        
        if (filtered.length === prods.length) return res.status(404).json({ error: 'Bulunamadı' });
        
        await dataAccess.writeJson(productsPath, filtered);
        res.json({ message: 'Ürün silindi' });
    } catch(e) { res.status(500).json({error: 'Hata oluştu'}); }
});

router.post('/admin/products/bulk-delete', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        const { codes } = req.body;
        let prods = await dataAccess.readJson(productsPath);
        
        const filtered = prods.filter(p => !codes.includes(String(p.kod)));
        
        await dataAccess.writeJson(productsPath, filtered);
        res.json({ message: 'Toplu silme başarılı' });
    } catch(e) { res.status(500).json({error: 'Hata oluştu'}); }
});

// --- CRUD: DİSTRİBÜTÖR ---
router.post('/admin/add-distributor', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        const { kod, ad, phone, email } = req.body;
        let dists = await dataAccess.readJson(distsPath);
        
        if (dists.find(d => d.kod === kod)) return res.status(400).json({ error: 'Bu kod zaten mevcut' });
        
        dists.push({ kod, ad, phone: phone || '', email: email || '' });
        
        await dataAccess.writeJson(distsPath, dists);
        res.json({ message: 'Distribütör eklendi' });
    } catch(e) { res.status(500).json({error: 'Hata: ' + e.message}); }
});

router.put('/admin/distributors/:code', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        let dists = await dataAccess.readJson(distsPath);
        const idx = dists.findIndex(d => String(d.kod) === String(req.params.code));
        
        if (idx === -1) return res.status(404).json({ error: 'Distribütör bulunamadı' });
        
        dists[idx] = { ...dists[idx], ...req.body };
        await dataAccess.writeJson(distsPath, dists);
        res.json({ message: 'Distribütör güncellendi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.delete('/admin/distributors/:code', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        let dists = await dataAccess.readJson(distsPath);
        const filtered = dists.filter(d => String(d.kod) !== String(req.params.code));
        await dataAccess.writeJson(distsPath, filtered);
        res.json({ message: 'Distribütör silindi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

// --- CRUD: KURUM ---
router.post('/admin/add-company', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        const { cariKod, ad, phone, email, discountRate } = req.body;
        let comps = await dataAccess.readJson(compPath);
        
        if (comps.find(c => c.cariKod === cariKod)) return res.status(400).json({ error: 'Bu kod zaten mevcut' });
        
        comps.push({ cariKod, ad, phone: phone || '', email: email || '', discountRate: parseFloat(discountRate) || 0 });
        
        await dataAccess.writeJson(compPath, comps);
        res.json({ message: 'Kurum eklendi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.put('/admin/companies/:code', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        let comps = await dataAccess.readJson(compPath);
        const idx = comps.findIndex(c => String(c.cariKod) === String(req.params.code));
        
        if (idx === -1) return res.status(404).json({ error: 'Kurum bulunamadı' });
        
        comps[idx] = { ...comps[idx], ...req.body };
        await dataAccess.writeJson(compPath, comps);
        res.json({ message: 'Kurum güncellendi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.delete('/admin/companies/:code', requireLogin, requirePermission('xml.manage'), csrfCheck, async (req, res) => {
    try {
        let comps = await dataAccess.readJson(compPath);
        const filtered = comps.filter(c => String(c.cariKod) !== String(req.params.code));
        await dataAccess.writeJson(compPath, filtered);
        res.json({ message: 'Kurum silindi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});


// --- KULLANICI YÖNETİMİ ---

router.get('/admin/users', requireLogin, requirePermission('users.manage'), async (req, res) => {
    try {
        const users = await dataAccess.readJson(usersPath);
        const safe = users.map(u => ({ id: u.id, username: u.username, displayName: u.displayName, role: u.role, permissions: u.permissions, isActive: u.isActive }));
        res.json(safe);
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.post('/admin/users', requireLogin, requirePermission('users.manage'), csrfCheck, async (req, res) => {
    try {
        const { username, displayName, role, password, permissions, warehouseId } = req.body;
        const users = await dataAccess.readJson(usersPath);
        const lower = username.toLowerCase();
        
        if (users.find(u => u.username === lower)) return res.status(400).json({ error: 'Kullanıcı adı kullanımda' });
        
        const hash = await bcrypt.hash(password, 10);
        const newUser = {
            id: makeId('u'),
            username: lower,
            displayName,
            role,
            passwordHash: hash,
            permissions: permissions || [],
            warehouseId: (role === 'warehouse' ? warehouseId : null),
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        users.push(newUser);
        await dataAccess.writeJson(usersPath, users);
        res.json({ message: 'Kullanıcı eklendi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.post('/admin/users/:id/password', requireLogin, requirePermission('users.manage'), csrfCheck, async (req, res) => {
    try {
        const users = await dataAccess.readJson(usersPath);
        const idx = users.findIndex(u => u.id === req.params.id);
        if (idx === -1) return res.status(404).json({error: 'Bulunamadı'});
        
        users[idx].passwordHash = await bcrypt.hash(req.body.password, 10);
        users[idx].updatedAt = new Date().toISOString();
        
        await dataAccess.writeJson(usersPath, users);
        res.json({ message: 'Şifre sıfırlandı' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.post('/admin/users/:id/toggle', requireLogin, requirePermission('users.manage'), csrfCheck, async (req, res) => {
    try {
        if (req.params.id === req.user.id) return res.status(400).json({error: 'Kendi durumunuzu değiştiremezsiniz'});
        const users = await dataAccess.readJson(usersPath);
        const idx = users.findIndex(u => u.id === req.params.id);
        if (idx === -1) return res.status(404).json({error: 'Bulunamadı'});
        
        users[idx].isActive = !users[idx].isActive;
        users[idx].updatedAt = new Date().toISOString();
        
        await dataAccess.writeJson(usersPath, users);
        res.json({ message: 'Durum değiştirildi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.put('/admin/users/:id/permissions', requireLogin, requirePermission('users.manage'), csrfCheck, async (req, res) => {
    try {
        const users = await dataAccess.readJson(usersPath);
        const idx = users.findIndex(u => u.id === req.params.id);
        if (idx === -1) return res.status(404).json({error: 'Bulunamadı'});
        
        users[idx].permissions = req.body.permissions;
        users[idx].updatedAt = new Date().toISOString();
        
        await dataAccess.writeJson(usersPath, users);
        res.json({ message: 'İzinler güncellendi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

router.delete('/admin/users/:id', requireLogin, requirePermission('users.manage'), csrfCheck, async (req, res) => {
    try {
        if (req.params.id === req.user.id) return res.status(400).json({error: 'Kendinizi silemezsiniz'});
        const users = await dataAccess.readJson(usersPath);
        const filtered = users.filter(u => u.id !== req.params.id);
        
        await dataAccess.writeJson(usersPath, filtered);
        res.json({ message: 'Kullanıcı silindi' });
    } catch(e) { res.status(500).json({error: 'Hata'}); }
});

// --- YEDEKLEME SİSTEMİ ---
function runBackup(reason) {
    const ts = Date.now();
    const backupDir = path.join(dataAccess.dataDir, 'backups', `${ts}_${reason}`);
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    
    const files = ['users.json', 'orders.json', 'products.xml', 'distributors.xml', 'companies.xml', 'warehouses.json', 'audit_logs.json', 'notes.json', 'note_settings.json'];
    
    files.forEach(f => {
        const source = path.join(dataAccess.dataDir, f);
        if (fs.existsSync(source)) {
            fs.copyFileSync(source, path.join(backupDir, f));
        }
    });
}

router.get('/admin/backup', requireRole('admin'), async (req, res) => {
    try {
        runBackup('manual');
        await dataAccess.appendAuditLog({ ts: new Date().toISOString(), userId: req.user.id, username: req.user.username, role: req.user.role, action: 'BACKUP_CREATED', entityType: 'system', entityId: 'backup', details: { type: 'manual' } });
        res.json({ message: 'Yedekleme başarıyla alındı.' });
    } catch(e) {
        res.status(500).json({ error: 'Yedekleme alınırken hata oluştu' });
    }
});
module.exports = router;
