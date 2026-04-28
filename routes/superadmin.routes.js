const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const dataAccess = require('../services/dataAccess');
const { requireLogin, requireSuperAdmin, csrfCheck } = require('../middlewares/auth.middleware');
const { makeId } = require('../utils/helpers');

// GET /api/superadmin/tenants - Tüm mağazaları listele
router.get('/tenants', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const tenants = await dataAccess.readJson('tenants.json');
        res.json(tenants);
    } catch (e) { res.status(500).json({ error: 'Mağazalar okunamadı' }); }
});

// POST /api/superadmin/add-tenant - Yeni mağaza kur (Kurumsal Bilgilerle)
router.post('/add-tenant', requireLogin, requireSuperAdmin, csrfCheck, async (req, res) => {
    try {
        const { 
            name, ownerEmail, ownerUsername, ownerPassword, plan,
            officialName, taxOffice, taxNumber, address, phone 
        } = req.body;
        
        const tenants = await dataAccess.readJson('tenants.json');
        const tenantId = 'T' + String(tenants.length + 1).padStart(3, '0');
        
        // 1. Yeni Mağaza Kaydı
        const newTenant = {
            id: tenantId,
            name,
            officialName: officialName || name,
            taxOffice: taxOffice || '',
            taxNumber: taxNumber || '',
            address: address || '',
            phone: phone || '',
            status: 'active',
            plan: plan || 'basic',
            category: 'Kırtasiye',
            subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date().toISOString()
        };
        tenants.push(newTenant);
        
        // 2. Klasör Yapısını Oluştur (Daireyi hazırla)
        const tenantDir = path.join(dataAccess.dataDir, tenantId);
        if (!fs.existsSync(tenantDir)) fs.mkdirSync(tenantDir, { recursive: true });
        if (!fs.existsSync(path.join(tenantDir, 'uploads'))) fs.mkdirSync(path.join(tenantDir, 'uploads'), { recursive: true });
        
        // 3. Boş Veri Dosyalarını Oluştur
        const defaultFiles = {
            'products.json': [],
            'orders.json': [],
            'distributors.json': [],
            'companies.json': [],
            'warehouses.json': [],
            'receivables.json': [],
            'notes.json': [],
            'audit_logs.json': []
        };
        
        for (const [file, content] of Object.entries(defaultFiles)) {
            fs.writeFileSync(path.join(tenantDir, file), JSON.stringify(content, null, 2));
        }

        // 4. Mağaza Sahibi (Admin) Kullanıcısını Oluştur
        const users = await dataAccess.readJson('users.json');
        const hash = await bcrypt.hash(ownerPassword, 10);
        const newAdmin = {
            id: makeId('u'),
            username: ownerUsername.toLowerCase(),
            displayName: name + ' Admin',
            role: 'admin',
            tenantId: tenantId,
            passwordHash: hash,
            permissions: [],
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        users.push(newAdmin);

        // 5. Kaydet
        await dataAccess.writeJson('tenants.json', tenants);
        await dataAccess.writeJson('users.json', users);

        res.json({ message: 'Yeni mağaza ve admin hesabı başarıyla oluşturuldu', tenantId });
    } catch (e) {
        console.error('Mağaza kurulum hatası:', e);
        res.status(500).json({ error: 'Mağaza kurulurken hata oluştu' });
    }
});

// PUT /api/superadmin/tenants/:id/status - Mağazayı askıya al veya aktifleştir (Mühürleme)
router.put('/tenants/:id/status', requireLogin, requireSuperAdmin, csrfCheck, async (req, res) => {
    try {
        const { status } = req.body; // 'active' or 'suspended'
        const tenants = await dataAccess.readJson('tenants.json');
        const idx = tenants.findIndex(t => t.id === req.params.id);
        if (idx === -1) return res.status(404).json({ error: 'Mağaza bulunamadı' });
        
        tenants[idx].status = status;
        await dataAccess.writeJson('tenants.json', tenants);
        
        res.json({ message: `Mağaza durumu ${status} olarak güncellendi` });
    } catch (e) { res.status(500).json({ error: 'Güncelleme hatası' }); }
});

// POST /api/superadmin/update-tenant - Mevcut Mağaza Bilgilerini Güncelle (Kurumsal)
router.post('/update-tenant', requireLogin, requireSuperAdmin, csrfCheck, async (req, res) => {
    try {
        const { 
            tenantId, name, officialName, taxOffice, taxNumber, 
            address, phone, category, plan, extendDays 
        } = req.body;

        let tenants = await dataAccess.readJson('tenants.json');
        const idx = tenants.findIndex(t => t.id === tenantId);
        if (idx === -1) return res.status(404).json({ error: 'Mağaza bulunamadı' });

        tenants[idx] = {
            ...tenants[idx],
            name: name || tenants[idx].name,
            officialName: officialName || tenants[idx].officialName || tenants[idx].name,
            taxOffice: taxOffice || tenants[idx].taxOffice || '',
            taxNumber: taxNumber || tenants[idx].taxNumber || '',
            address: address || tenants[idx].address || '',
            phone: phone || tenants[idx].phone || '',
            category: category || tenants[idx].category || 'Kırtasiye',
            plan: plan || tenants[idx].plan || 'basic'
        };

        if (extendDays && parseInt(extendDays) > 0) {
            const currentExpiry = new Date(tenants[idx].subscriptionExpiry || Date.now());
            currentExpiry.setDate(currentExpiry.getDate() + parseInt(extendDays));
            tenants[idx].subscriptionExpiry = currentExpiry.toISOString();
        }

        await dataAccess.writeJson('tenants.json', tenants);
        res.json({ message: 'Mağaza bilgileri güncellendi' });
    } catch(e) { res.status(500).json({ error: 'Güncelleme hatası' }); }
});

// GET /api/superadmin/users - Platformdaki TÜM kullanıcıları gör
router.get('/users', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const users = await dataAccess.readJson('users.json');
        const safeUsers = users.map(u => ({
            id: u.id,
            username: u.username,
            displayName: u.displayName,
            role: u.role,
            tenantId: u.tenantId,
            isActive: u.isActive,
            createdAt: u.createdAt
        }));
        res.json(safeUsers);
    } catch (e) { res.status(500).json({ error: 'Kullanıcılar okunamadı' }); }
});

// GET /api/superadmin/tenants/:id/stats - Mağaza detay istatistikleri
router.get('/tenants/:id/stats', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const tenantId = req.params.id;
        const orders = await dataAccess.readJson('orders.json', tenantId);
        const products = await dataAccess.readJson('products.json', tenantId);
        const users = await dataAccess.readJson('users.json');
        const tenantUsers = users.filter(u => u.tenantId === tenantId);
        
        const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.finalAmount || o.totalAmount) || 0), 0);
        const activeOrders = orders.filter(o => o.status !== 'TESLİM EDİLDİ' && o.status !== 'İPTAL').length;
        
        res.json({
            orderCount: orders.length,
            productCount: products.length,
            userCount: tenantUsers.length,
            totalRevenue,
            activeOrders,
            lastOrderDate: orders.length > 0 ? orders[orders.length - 1].createdAt : null
        });
    } catch (e) { res.status(500).json({ error: 'İstatistikler okunamadı' }); }
});

// GET /api/superadmin/dashboard - Platform genel istatistikleri
router.get('/dashboard', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const tenants = await dataAccess.readJson('tenants.json');
        const users = await dataAccess.readJson('users.json');
        
        let totalOrders = 0;
        let totalRevenue = 0;
        let subRevenue = 0; // Boss'un kazancı
        const tenantStats = [];

        const planPrices = { basic: 0, premium: 2500, enterprise: 7500 };
        
        for (const t of tenants) {
            const orders = await dataAccess.readJson('orders.json', t.id);
            const products = await dataAccess.readJson('products.json', t.id);
            const tUsers = users.filter(u => u.tenantId === t.id);
            
            // CİRO FİLTRESİ: İptal ve Numuneleri çıkarıyoruz
            const validOrders = orders.filter(o => 
                o.status !== 'IPTAL' && 
                o.status !== 'İPTAL' && 
                o.orderType !== 'NUMUNE'
            );
            
            const rev = validOrders.reduce((sum, o) => sum + (parseFloat(o.finalAmount || o.totalAmount) || 0), 0);
            
            totalOrders += validOrders.length;
            totalRevenue += rev;

            if (t.status === 'active') {
                subRevenue += planPrices[t.plan] || 0;
            }
            
            tenantStats.push({
                ...t,
                orderCount: validOrders.length,
                productCount: products.length,
                userCount: tUsers.length,
                revenue: rev
            });
        }
        
        res.json({
            totalTenants: tenants.length,
            activeTenants: tenants.filter(t => t.status === 'active').length,
            suspendedTenants: tenants.filter(t => t.status === 'suspended').length,
            totalUsers: users.length,
            totalOrders,
            totalRevenue,
            subscriptionRevenue: subRevenue, // Senin kazancın
            tenantStats
        });
    } catch (e) { res.status(500).json({ error: 'Dashboard verileri okunamadı' }); }
});

// PUT /api/superadmin/tenants/:id/subscription - Abonelik uzat / plan değiştir
router.put('/tenants/:id/subscription', requireLogin, requireSuperAdmin, csrfCheck, async (req, res) => {
    try {
        const { plan, extendDays } = req.body;
        const tenants = await dataAccess.readJson('tenants.json');
        const idx = tenants.findIndex(t => t.id === req.params.id);
        if (idx === -1) return res.status(404).json({ error: 'Mağaza bulunamadı' });
        
        if (plan) tenants[idx].plan = plan;
        if (extendDays) {
            const currentExpiry = new Date(tenants[idx].subscriptionExpiry || Date.now());
            currentExpiry.setDate(currentExpiry.getDate() + parseInt(extendDays));
            tenants[idx].subscriptionExpiry = currentExpiry.toISOString();
        }
        
        await dataAccess.writeJson('tenants.json', tenants);
        res.json({ message: 'Abonelik güncellendi', tenant: tenants[idx] });
    } catch (e) { res.status(500).json({ error: 'Abonelik güncellenemedi' }); }
});

// GET /api/superadmin/global-orders - Tüm platformdaki TÜM siparişler
router.get('/global-orders', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const tenants = await dataAccess.readJson('tenants.json');
        let allOrders = [];
        for (const t of tenants) {
            const orders = await dataAccess.readJson('orders.json', t.id);
            allOrders = allOrders.concat(orders.map(o => ({ ...o, tenantName: t.name, tenantId: t.id })));
        }
        res.json(allOrders.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (e) { res.status(500).json({ error: 'Global siparişler okunamadı' }); }
});

// GET /api/superadmin/global-companies - Tüm platformdaki TÜM müşteriler
router.get('/global-companies', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const tenants = await dataAccess.readJson('tenants.json');
        let allCompanies = [];
        for (const t of tenants) {
            try {
                const companies = await dataAccess.readJson('companies.json', t.id);
                allCompanies = allCompanies.concat(companies.map(c => ({ 
                    ...c, 
                    code: c.code || c.cariKod || 'YOK',
                    name: c.ad || c.name || c.unvan || 'İSİMSİZ', // 'ad' eklendi
                    phone: c.phone || c.tel || '-',
                    email: c.email || c.eposta || '-',
                    discountRate: c.discountRate || c.sabitIskonto || 0,
                    tenantName: t.name, 
                    tenantId: t.id 
                })));
            } catch(err) { console.error(`Tenant ${t.id} companies load error:`, err); }
        }
        res.json(allCompanies);
    } catch (e) { res.status(500).json({ error: 'Global müşteriler okunamadı' }); }
});

// POST /api/superadmin/tenants/auto-categorize - Akıllı Kategori Analizi
router.get('/auto-categorize', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const tenants = await dataAccess.readJson('tenants.json');
        let updatedCount = 0;
        
        for (const t of tenants) {
            const products = await dataAccess.readJson('products.json', t.id);
            const names = products.map(p => (p.name || '').toLowerCase()).join(' ');
            
            let category = 'Genel';
            if (/kalem|kağıt|defter|silgi|dosya|kitap|kırtasiye/i.test(names)) category = 'Kırtasiye';
            else if (/süt|peynir|ekmek|gıda|yağ|şeker/i.test(names)) category = 'Market / Gıda';
            else if (/bilgisayar|telefon|mause|klavye|elektronik/i.test(names)) category = 'Teknoloji';
            else if (/mobilya|masa|sandalye|ofis/i.test(names)) category = 'Ofis Mobilyası';
            
            if (t.category !== category) {
                t.category = category;
                updatedCount++;
            }
        }
        
        await dataAccess.writeJson('tenants.json', tenants);
        res.json({ message: 'Akıllı analiz tamamlandı', updatedCount, tenants });
    } catch (e) { res.status(500).json({ error: 'Otomatik analiz hatası' }); }
});

// PUT /api/superadmin/tenants/:id/category - Manuel Kategori Düzenleme
router.put('/tenants/:id/category', requireLogin, requireSuperAdmin, csrfCheck, async (req, res) => {
    try {
        const { category } = req.body;
        const tenants = await dataAccess.readJson('tenants.json');
        const idx = tenants.findIndex(t => t.id === req.params.id);
        if (idx === -1) return res.status(404).json({ error: 'Mağaza bulunamadı' });
        
        tenants[idx].category = category;
        await dataAccess.writeJson('tenants.json', tenants);
        res.json({ message: 'Kategori güncellendi' });
    } catch (e) { res.status(500).json({ error: 'Güncelleme hatası' }); }
});

// GET /api/superadmin/analytics/top-products - Platform genelinde EN ÇOK SATANLAR
router.get('/analytics/top-products', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const tenants = await dataAccess.readJson('tenants.json');
        const sales = {};
        for (const t of tenants) {
            const orders = await dataAccess.readJson('orders.json', t.id);
            orders.forEach(o => {
                (o.items || []).forEach(item => {
                    const key = `${item.code} - ${item.name}`;
                    sales[key] = (sales[key] || 0) + (parseInt(item.qty) || 0);
                });
            });
        }
        const top = Object.entries(sales).map(([name, qty]) => ({ name, qty })).sort((a,b) => b.qty - a.qty).slice(0, 10);
        res.json(top);
    } catch (e) { res.status(500).json({ error: 'Analiz hatası' }); }
});

// GET /api/superadmin/global-ordered-products - Tüm platformdaki satılan ürünleri tarihli getir
router.get('/global-ordered-products', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const tenants = await dataAccess.readJson('tenants.json');
        let allOrderedProducts = [];
        
        for (const t of tenants) {
            try {
                const orders = await dataAccess.readJson('orders.json', t.id);
                // İptal ve Numune olmayan gerçek satışlar
                const validOrders = orders.filter(o => o.status !== 'IPTAL' && o.status !== 'İPTAL' && o.orderType !== 'NUMUNE');
                validOrders.forEach(o => {
                    (o.items || []).forEach(item => {
                        allOrderedProducts.push({
                            tenantName: t.name,
                            code: item.code,
                            name: item.name,
                            qty: item.qty,
                            date: o.createdAt // Satış tarihi
                        });
                    });
                });
            } catch(e) {}
        }
        // En yeni satış en üstte
        allOrderedProducts.sort((a,b) => new Date(b.date) - new Date(a.date));
        res.json(allOrderedProducts);
    } catch (e) { res.status(500).json({ error: 'Ürün analizi başarısız' }); }
});

// GET /api/superadmin/export/global-companies - Çok Sekmeli & Şık XML Excel Raporu
router.get('/export/global-companies', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const tenants = await dataAccess.readJson('tenants.json');
        
        let productRows = "";
        let companyRows = "";

        for (const t of tenants) {
            // Ürünler (Tarihli Satırlar)
            try {
                const orders = await dataAccess.readJson('orders.json', t.id);
                const validOrders = orders.filter(o => o.status !== 'IPTAL' && o.status !== 'İPTAL' && o.orderType !== 'NUMUNE');
                validOrders.forEach(o => {
                    const orderDate = new Date(o.createdAt).toLocaleDateString('tr-TR');
                    (o.items || []).forEach(item => {
                        productRows += `<Row>
                            <Cell><Data ss:Type="String">${t.name}</Data></Cell>
                            <Cell><Data ss:Type="String">${orderDate}</Data></Cell>
                            <Cell><Data ss:Type="String">${item.code}</Data></Cell>
                            <Cell><Data ss:Type="String">${item.name}</Data></Cell>
                            <Cell><Data ss:Type="Number">${item.qty}</Data></Cell>
                        </Row>`;
                    });
                });
            } catch(e) {}

            // Müşteriler
            try {
                const comps = await dataAccess.readJson('companies.json', t.id);
                comps.forEach(c => {
                    companyRows += `<Row>
                        <Cell><Data ss:Type="String">${t.name}</Data></Cell>
                        <Cell><Data ss:Type="String">${c.ad || c.name || '-'}</Data></Cell>
                        <Cell><Data ss:Type="String">${c.taxOffice || '-'}</Data></Cell>
                        <Cell><Data ss:Type="String">${c.taxNumber || '-'}</Data></Cell>
                        <Cell><Data ss:Type="String">${(c.address || '-').replace(/\n/g, " ")}</Data></Cell>
                        <Cell><Data ss:Type="String">${c.phone || '-'}</Data></Cell>
                        <Cell><Data ss:Type="String">${c.email || '-'}</Data></Cell>
                        <Cell><Data ss:Type="Number">${c.discountRate || 0}</Data></Cell>
                    </Row>`;
                });
            } catch(e) {}
        }

        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">
    <Styles>
        <Style ss:ID="Header">
            <Font ss:Bold="1" ss:Color="#FFFFFF"/>
            <Interior ss:Color="#D4AF37" ss:Pattern="Solid"/>
            <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
        </Style>
    </Styles>
    <Worksheet ss:Name="Ürün Satış Analizi">
        <Table>
            <Column ss:Width="150"/><Column ss:Width="100"/><Column ss:Width="100"/><Column ss:Width="250"/><Column ss:Width="100"/>
            <Row ss:StyleID="Header">
                <Cell><Data ss:Type="String">Mağaza</Data></Cell>
                <Cell><Data ss:Type="String">Satış Tarihi</Data></Cell>
                <Cell><Data ss:Type="String">Ürün Kodu</Data></Cell>
                <Cell><Data ss:Type="String">Ürün Adı</Data></Cell>
                <Cell><Data ss:Type="String">Satış Adedi</Data></Cell>
            </Row>
            ${productRows}
        </Table>
    </Worksheet>
    <Worksheet ss:Name="Müşteri Detayları">
        <Table>
            <Column ss:Width="150"/><Column ss:Width="200"/><Column ss:Width="120"/><Column ss:Width="100"/><Column ss:Width="300"/><Column ss:Width="100"/><Column ss:Width="150"/><Column ss:Width="80"/>
            <Row ss:StyleID="Header">
                <Cell><Data ss:Type="String">Mağaza</Data></Cell>
                <Cell><Data ss:Type="String">Müşteri (Unvan)</Data></Cell>
                <Cell><Data ss:Type="String">Vergi Dairesi</Data></Cell>
                <Cell><Data ss:Type="String">Vergi No</Data></Cell>
                <Cell><Data ss:Type="String">Adres</Data></Cell>
                <Cell><Data ss:Type="String">Telefon</Data></Cell>
                <Cell><Data ss:Type="String">E-Posta</Data></Cell>
                <Cell><Data ss:Type="String">İskonto (%)</Data></Cell>
            </Row>
            ${companyRows}
        </Table>
    </Worksheet>
</Workbook>`;

        res.setHeader('Content-Type', 'application/vnd.ms-excel');
        res.setHeader('Content-Disposition', 'attachment; filename=Statio_Master_Data_Raporu.xls');
        res.send(xmlContent);

    } catch (e) { 
        console.error('Excel Export Error:', e);
        res.status(500).send('Rapor hazırlanamadı.'); 
    }
});

// GET /api/superadmin/analytics/accounting - Mağaza Satış Performansı (Alacak Değil, Toplam Satış)
router.get('/analytics/accounting', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const tenants = await dataAccess.readJson('tenants.json');
        let totalPlatformSales = 0;
        let tenantSales = [];
        
        for (const t of tenants) {
            const orders = await dataAccess.readJson('orders.json', t.id);
            // Sadece geçerli siparişleri (İptal ve Numune olmayanları) topla
            const validOrders = orders.filter(o => 
                o.status !== 'IPTAL' && 
                o.status !== 'İPTAL' && 
                o.orderType !== 'NUMUNE'
            );
            const tenantTotal = validOrders.reduce((sum, o) => sum + (parseFloat(o.finalAmount || o.totalAmount) || 0), 0);
            
            totalPlatformSales += tenantTotal;
            tenantSales.push({ id: t.id, name: t.name, balance: tenantTotal }); // 'balance' ismini JS tarafı bozulmasın diye tuttum, içerik artık satış tutarı.
        }
        res.json({ totalReceivable: totalPlatformSales, tenantBalances: tenantSales });
    } catch (e) { res.status(500).json({ error: 'Satış verileri okunamadı' }); }
});

// POST /api/superadmin/switch-tenant/:id - Mağaza paneline geçiş yap
router.post('/switch-tenant/:id', requireLogin, requireSuperAdmin, csrfCheck, async (req, res) => {
    try {
        const tenants = await dataAccess.readJson('tenants.json');
        const tenant = tenants.find(t => t.id === req.params.id);
        if (!tenant) return res.status(404).json({ error: 'Mağaza bulunamadı' });
        
        // Session'daki tenantId'yi değiştir
        req.session.tenantId = tenant.id;
        res.json({ message: `${tenant.name} mağazasına geçiş yapıldı`, tenantId: tenant.id });
    } catch (e) { res.status(500).json({ error: 'Geçiş hatası' }); }
});

module.exports = router;
