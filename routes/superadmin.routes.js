const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const prisma = require('../services/db.service');
const emailService = require('../services/notification.service');
const { requireLogin, requireSuperAdmin, csrfCheck } = require('../middlewares/auth.middleware');
const { makeId } = require('../utils/helpers');

// GET /api/superadmin/tenants - Tüm mağazaları listele
router.get('/tenants', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const tenants = await prisma.tenant.findMany({
            orderBy: { createdAt: 'desc' }
        });
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
        
        const hash = await bcrypt.hash(ownerPassword, 10);

        const result = await prisma.$transaction(async (tx) => {
            // 1. Yeni Mağaza Kaydı
            const newTenant = await tx.tenant.create({
                data: {
                    name,
                    officialName: officialName || name,
                    taxOffice: taxOffice || '',
                    taxNumber: taxNumber || '',
                    address: address || '',
                    phone: phone || '',
                    status: 'active',
                    plan: plan || 'basic',
                    category: 'Kırtasiye',
                    subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    ownerEmail: ownerEmail,
                    ownerName: name + ' Sahibi'
                }
            });

            // 2. Mağaza Sahibi (Admin) Kullanıcısını Oluştur
            await tx.user.create({
                data: {
                    username: ownerUsername.toLowerCase(),
                    displayName: name + ' Admin',
                    role: 'admin',
                    tenantId: newTenant.id,
                    passwordHash: hash,
                    permissions: '[]',
                    isActive: true
                }
            });

            return newTenant;
        });

        res.json({ message: 'Yeni mağaza ve admin hesabı başarıyla oluşturuldu', tenantId: result.id });
    } catch (e) {
        console.error('Mağaza kurulum hatası:', e);
        res.status(500).json({ error: 'Mağaza kurulurken hata oluştu' });
    }
});

// PUT /api/superadmin/tenants/:id/status - Mağazayı askıya al veya aktifleştir (Mühürleme)
router.put('/tenants/:id/status', requireLogin, requireSuperAdmin, csrfCheck, async (req, res) => {
    try {
        const { status } = req.body;
        await prisma.tenant.update({
            where: { id: req.params.id },
            data: { status }
        });
        res.json({ message: `Mağaza durumu ${status} olarak güncellendi` });
    } catch (e) { res.status(500).json({ error: 'Güncelleme hatası' }); }
});

// POST /api/superadmin/approve-tenant - Bekleyen kaydı onayla
router.post('/approve-tenant', requireLogin, requireSuperAdmin, csrfCheck, async (req, res) => {
    try {
        const { tenantId } = req.body;
        
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) return res.status(404).json({ error: 'Mağaza bulunamadı' });

        const updated = await prisma.tenant.update({
            where: { id: tenantId },
            data: { 
                status: 'active',
                subscriptionExpiry: tenant.subscriptionExpiry || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
        });

        // E-posta gönder (Hoşgeldiniz/Onaylandı)
        if (tenant.ownerEmail) {
            emailService.sendAccountApprovedEmail(tenant.ownerEmail, tenant.ownerName || tenant.name)
                .catch(e => console.error('Approval email error:', e));
        }

        res.json({ message: 'Mağaza başarıyla onaylandı ve aktifleştirildi.' });
    } catch (e) { 
        console.error('Approve error:', e);
        res.status(500).json({ error: 'Onaylama sırasında hata oluştu' }); 
    }
});

// POST /api/superadmin/update-tenant - Mevcut Mağaza Bilgilerini Güncelle (Kurumsal)
router.post('/update-tenant', requireLogin, requireSuperAdmin, csrfCheck, async (req, res) => {
    try {
        const { 
            tenantId, name, officialName, taxOffice, taxNumber, 
            address, phone, category, plan, extendDays 
        } = req.body;

        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) return res.status(404).json({ error: 'Mağaza bulunamadı' });

        const data = {
            name: name || tenant.name,
            officialName: officialName || tenant.officialName || tenant.name,
            taxOffice: taxOffice || tenant.taxOffice || '',
            taxNumber: taxNumber || tenant.taxNumber || '',
            address: address || tenant.address || '',
            phone: phone || tenant.phone || '',
            category: category || tenant.category || 'Kırtasiye',
            plan: plan || tenant.plan || 'basic'
        };

        if (extendDays && parseInt(extendDays) > 0) {
            const currentExpiry = new Date(tenant.subscriptionExpiry || Date.now());
            currentExpiry.setDate(currentExpiry.getDate() + parseInt(extendDays));
            data.subscriptionExpiry = currentExpiry;
        }

        await prisma.tenant.update({
            where: { id: tenantId },
            data
        });
        res.json({ message: 'Mağaza bilgileri güncellendi' });
    } catch(e) { res.status(500).json({ error: 'Güncelleme hatası' }); }
});

// GET /api/superadmin/users - Platformdaki TÜM kullanıcıları gör
router.get('/users', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                displayName: true,
                role: true,
                tenantId: true,
                isActive: true,
                createdAt: true
            }
        });
        res.json(users);
    } catch (e) { res.status(500).json({ error: 'Kullanıcılar okunamadı' }); }
});

// GET /api/superadmin/tenants/:id/stats - Mağaza detay istatistikleri
router.get('/tenants/:id/stats', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const tenantId = req.params.id;
        const [orders, products, users] = await Promise.all([
            prisma.order.findMany({ where: { tenantId } }),
            prisma.product.count({ where: { tenantId } }),
            prisma.user.count({ where: { tenantId } })
        ]);
        
        const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.finalAmount) || 0), 0);
        const activeOrders = orders.filter(o => o.status !== 'TESLİM EDİLDİ' && o.status !== 'İPTAL').length;
        
        res.json({
            orderCount: orders.length,
            productCount: products,
            userCount: users,
            totalRevenue,
            activeOrders,
            lastOrderDate: orders.length > 0 ? orders[orders.length - 1].createdAt : null
        });
    } catch (e) { res.status(500).json({ error: 'İstatistikler okunamadı' }); }
});

// GET /api/superadmin/dashboard - Platform genel istatistikleri
router.get('/dashboard', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const [tenants, allOrders, usersCount] = await Promise.all([
            prisma.tenant.findMany({
                include: {
                    _count: {
                        select: { orders: true, products: true, users: true }
                    }
                }
            }),
            prisma.order.findMany({
                where: {
                    status: { notIn: ['IPTAL', 'İPTAL'] },
                    orderType: { not: 'NUMUNE' }
                },
                select: { finalAmount: true, tenantId: true }
            }),
            prisma.user.count()
        ]);
        
        let totalOrders = allOrders.length;
        let totalRevenue = allOrders.reduce((sum, o) => sum + (o.finalAmount || 0), 0);
        let subRevenue = 0;

        const planPrices = { basic: 0, premium: 2500, enterprise: 7500 };
        
        const tenantStats = tenants.map(t => {
            const tOrders = allOrders.filter(o => o.tenantId === t.id);
            const tRevenue = tOrders.reduce((sum, o) => sum + (o.finalAmount || 0), 0);
            
            if (t.status === 'active') {
                subRevenue += planPrices[t.plan] || 0;
            }

            return {
                ...t,
                orderCount: t.status === 'active' ? t._count.orders : 0, // Simplified or detailed as needed
                productCount: t._count.products,
                userCount: t._count.users,
                revenue: tRevenue
            };
        });
        
        res.json({
            totalTenants: tenants.length,
            activeTenants: tenants.filter(t => t.status === 'active').length,
            suspendedTenants: tenants.filter(t => t.status === 'suspended').length,
            pendingTenants: tenants.filter(t => t.status === 'pending_approval').length,
            totalUsers: usersCount,
            totalOrders,
            totalRevenue,
            subscriptionRevenue: subRevenue,
            tenantStats
        });
    } catch (e) { 
        console.error('Dashboard error:', e);
        res.status(500).json({ error: 'Dashboard verileri okunamadı' }); 
    }
});

// PUT /api/superadmin/tenants/:id/subscription - Abonelik uzat / plan değiştir
router.put('/tenants/:id/subscription', requireLogin, requireSuperAdmin, csrfCheck, async (req, res) => {
    try {
        const { plan, extendDays } = req.body;
        const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
        if (!tenant) return res.status(404).json({ error: 'Mağaza bulunamadı' });
        
        const data = {};
        if (plan) data.plan = plan;
        if (extendDays) {
            const currentExpiry = new Date(tenant.subscriptionExpiry || Date.now());
            currentExpiry.setDate(currentExpiry.getDate() + parseInt(extendDays));
            data.subscriptionExpiry = currentExpiry;
        }
        
        const updated = await prisma.tenant.update({
            where: { id: req.params.id },
            data
        });
        res.json({ message: 'Abonelik güncellendi', tenant: updated });
    } catch (e) { res.status(500).json({ error: 'Abonelik güncellenemedi' }); }
});

// GET /api/superadmin/global-orders - Tüm platformdaki TÜM siparişler
router.get('/global-orders', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            include: { tenant: { select: { name: true } } },
            orderBy: { createdAt: 'desc' }
        });
        const mapped = orders.map(o => ({ ...o, tenantName: o.tenant.name }));
        res.json(mapped);
    } catch (e) { res.status(500).json({ error: 'Global siparişler okunamadı' }); }
});

// GET /api/superadmin/global-companies - Tüm platformdaki TÜM müşteriler
router.get('/global-companies', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const companies = await prisma.company.findMany({
            include: { tenant: { select: { name: true } } }
        });
        const mapped = companies.map(c => ({
            ...c,
            code: c.cariKod,
            name: c.ad,
            tenantName: c.tenant.name
        }));
        res.json(mapped);
    } catch (e) { res.status(500).json({ error: 'Global müşteriler okunamadı' }); }
});

// POST /api/superadmin/tenants/auto-categorize - Akıllı Kategori Analizi
router.get('/auto-categorize', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const tenants = await prisma.tenant.findMany({ include: { products: { take: 50 } } });
        let updatedCount = 0;
        
        for (const t of tenants) {
            const names = t.products.map(p => (p.ad || '').toLowerCase()).join(' ');
            
            let category = 'Genel';
            if (/kalem|kağıt|defter|silgi|dosya|kitap|kırtasiye/i.test(names)) category = 'Kırtasiye';
            else if (/süt|peynir|ekmek|gıda|yağ|şeker/i.test(names)) category = 'Market / Gıda';
            else if (/bilgisayar|telefon|mause|klavye|elektronik/i.test(names)) category = 'Teknoloji';
            else if (/mobilya|masa|sandalye|ofis/i.test(names)) category = 'Ofis Mobilyası';
            
            if (t.category !== category) {
                await prisma.tenant.update({ where: { id: t.id }, data: { category } });
                updatedCount++;
            }
        }
        
        res.json({ message: 'Akıllı analiz tamamlandı', updatedCount });
    } catch (e) { res.status(500).json({ error: 'Otomatik analiz hatası' }); }
});

// PUT /api/superadmin/tenants/:id/category - Manuel Kategori Düzenleme
router.put('/tenants/:id/category', requireLogin, requireSuperAdmin, csrfCheck, async (req, res) => {
    try {
        const { category } = req.body;
        await prisma.tenant.update({
            where: { id: req.params.id },
            data: { category }
        });
        res.json({ message: 'Kategori güncellendi' });
    } catch (e) { res.status(500).json({ error: 'Güncelleme hatası' }); }
});

// GET /api/superadmin/analytics/top-products - Platform genelinde EN ÇOK SATANLAR
router.get('/analytics/top-products', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const topItems = await prisma.orderItem.groupBy({
            by: ['code', 'name'],
            _sum: { qty: true },
            orderBy: { _sum: { qty: 'desc' } },
            take: 10
        });
        res.json(topItems.map(i => ({ name: `${i.code} - ${i.name}`, qty: i._sum.qty })));
    } catch (e) { res.status(500).json({ error: 'Analiz hatası' }); }
});

// GET /api/superadmin/global-ordered-products - Tüm platformdaki satılan ürünleri tarihli getir
router.get('/global-ordered-products', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const items = await prisma.orderItem.findMany({
            where: {
                order: {
                    status: { notIn: ['IPTAL', 'İPTAL'] },
                    orderType: { not: 'NUMUNE' }
                }
            },
            include: {
                order: { include: { tenant: { select: { name: true } } } }
            },
            orderBy: { order: { createdAt: 'desc' } }
        });

        const mapped = items.map(i => ({
            tenantName: i.order.tenant.name,
            code: i.code,
            name: i.name,
            qty: i.qty,
            date: i.order.createdAt
        }));

        res.json(mapped);
    } catch (e) { res.status(500).json({ error: 'Ürün analizi başarısız' }); }
});

// GET /api/superadmin/export/global-companies - Çok Sekmeli & Şık XML Excel Raporu
router.get('/export/global-companies', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const tenants = await prisma.tenant.findMany();
        
        let productRows = "";
        let companyRows = "";

        for (const t of tenants) {
            // Ürünler (Tarihli Satırlar)
            try {
                const orders = await prisma.order.findMany({
                    where: { tenantId: t.id, status: { notIn: ['IPTAL', 'İPTAL'] }, orderType: { not: 'NUMUNE' } },
                    include: { items: true },
                    orderBy: { createdAt: 'desc' }
                });
                orders.forEach(o => {
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
                const comps = await prisma.company.findMany({ where: { tenantId: t.id } });
                comps.forEach(c => {
                    companyRows += `<Row>
                        <Cell><Data ss:Type="String">${t.name}</Data></Cell>
                        <Cell><Data ss:Type="String">${c.ad || '-'}</Data></Cell>
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

// GET /api/superadmin/analytics/accounting - Mağaza Satış Performansı
router.get('/analytics/accounting', requireLogin, requireSuperAdmin, async (req, res) => {
    try {
        const tenants = await prisma.tenant.findMany({
            include: {
                orders: {
                    where: {
                        status: { notIn: ['IPTAL', 'İPTAL'] },
                        orderType: { not: 'NUMUNE' }
                    },
                    select: { finalAmount: true }
                }
            }
        });

        let totalPlatformSales = 0;
        const tenantSales = tenants.map(t => {
            const tenantTotal = t.orders.reduce((sum, o) => sum + (o.finalAmount || 0), 0);
            totalPlatformSales += tenantTotal;
            return { id: t.id, name: t.name, balance: tenantTotal };
        });

        res.json({ totalReceivable: totalPlatformSales, tenantBalances: tenantSales });
    } catch (e) { res.status(500).json({ error: 'Satış verileri okunamadı' }); }
});

// POST /api/superadmin/switch-tenant/:id - Mağaza paneline geçiş yap
router.post('/switch-tenant/:id', requireLogin, requireSuperAdmin, csrfCheck, async (req, res) => {
    try {
        const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
        if (!tenant) return res.status(404).json({ error: 'Mağaza bulunamadı' });
        
        req.session.tenantId = tenant.id;
        res.json({ message: `${tenant.name} mağazasına geçiş yapıldı`, tenantId: tenant.id });
    } catch (e) { res.status(500).json({ error: 'Geçiş hatası' }); }
});

module.exports = router;
