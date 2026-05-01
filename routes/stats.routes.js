const express = require('express');
const router = express.Router();
const prisma = require('../services/db.service');
const { requireLogin, requireRole } = require('../middlewares/auth.middleware');

router.get('/dashboard', requireLogin, requireRole('admin'), async (req, res) => {
    try {
        const [orders, products, companies] = await Promise.all([
            prisma.order.findMany({
                where: { tenantId: req.user.tenantId },
                include: { items: true }
            }),
            prisma.product.findMany({
                where: { tenantId: req.user.tenantId }
            }),
            prisma.company.findMany({
                where: { tenantId: req.user.tenantId }
            })
        ]);

        // Critical Stock
        const criticalStock = products.filter(p => (p.stock || 0) < (p.minStock || 10)).map(p => ({
            code: p.kod,
            name: p.ad,
            stock: p.stock || 0,
            minStock: p.minStock || 10
        }));

        const stats = {
            totalSalesAmount: 0,
            totalOrders: 0,
            totalSamples: 0,
            totalItemsSold: 0,
            topProducts: [],
            topCompanies: [],
            topSampleCompanies: [],
            salesTrend: {},
            criticalStock
        };

        const productSales = {};
        const companySales = {};
        const companySamples = {};

        orders.forEach(order => {
            const date = order.createdAt.toISOString().split('T')[0];
            
            if (order.orderType === 'SIPARIS') {
                stats.totalOrders++;
                stats.totalSalesAmount += (order.finalAmount || 0);
                
                // Sales Trend
                stats.salesTrend[date] = (stats.salesTrend[date] || 0) + (order.finalAmount || 0);

                // Company Sales
                companySales[order.companyCode] = (companySales[order.companyCode] || 0) + (order.finalAmount || 0);

                // Product Sales
                order.items.forEach(item => {
                    const q = parseInt(item.qty || item.miktar) || 0;
                    productSales[item.code] = productSales[item.code] || { name: item.name, qty: 0 };
                    productSales[item.code].qty += q;
                    stats.totalItemsSold += q;
                });
            } else if (order.orderType === 'NUMUNE') {
                stats.totalSamples++;
                companySamples[order.companyCode] = (companySamples[order.companyCode] || 0) + 1;
            }
        });

        // Sort Top Products
        stats.topProducts = Object.entries(productSales)
            .map(([code, data]) => ({ code, name: data.name, qty: data.qty }))
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 10);

        // Sort Top Companies (Sales)
        stats.topCompanies = Object.entries(companySales)
            .map(([code, amount]) => {
                const comp = companies.find(c => c.cariKod === code);
                return { code, name: comp ? comp.ad : code, amount };
            })
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 10);

        // Sort Top Companies (Samples)
        stats.topSampleCompanies = Object.entries(companySamples)
            .map(([code, count]) => {
                const comp = companies.find(c => c.cariKod === code);
                return { code, name: comp ? comp.ad : code, count };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        res.json(stats);
    } catch (e) {
        console.error('Stats error:', e);
        res.status(500).json({ error: 'İstatistikler hesaplanamadı' });
    }
});

router.get('/product/:code', requireLogin, requireRole('admin'), async (req, res) => {
    try {
        const { code } = req.params;
        const productOrders = await prisma.order.findMany({
            where: {
                tenantId: req.user.tenantId,
                orderType: 'SIPARIS',
                items: { some: { code: code } }
            },
            include: { items: true }
        });

        const mapped = productOrders.map(o => {
            const item = o.items.find(i => i.code === code);
            return {
                id: o.id,
                companyCode: o.companyCode,
                date: o.createdAt,
                qty: (item.qty || 0),
                status: o.status
            };
        });

        res.json(mapped);
    } catch (e) {
        res.status(500).json({ error: 'Ürün detayları alınamadı' });
    }
});

router.get('/company/:code', requireLogin, requireRole('admin'), async (req, res) => {
    try {
        const { code } = req.params;
        const companyOrders = await prisma.order.findMany({
            where: {
                tenantId: req.user.tenantId,
                companyCode: code
            }
        });

        const mapped = companyOrders.map(o => ({
                id: o.id,
                orderType: o.orderType,
                date: o.createdAt,
                amount: o.finalAmount,
                status: o.status
            }));

        res.json(mapped);
    } catch (e) {
        res.status(500).json({ error: 'Cari detayları alınamadı' });
    }
});

module.exports = router;
