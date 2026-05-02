const express = require('express');
const router = express.Router();
const prisma = require('../services/db.service');
const { requireLogin, requireRole } = require('../middlewares/auth.middleware');

router.get('/dashboard', requireLogin, requireRole('admin'), async (req, res) => {
    try {
        const [invoices, products, companies] = await Promise.all([
            prisma.invoice.findMany({
                where: { tenantId: req.user.tenantId }
            }),
            prisma.product.findMany({
                where: { tenantId: req.user.tenantId }
            }),
            prisma.company.findMany({
                where: { tenantId: req.user.tenantId }
            })
        ]);

        const cashTransactions = await prisma.cashTransaction.findMany({
            where: { tenantId: req.user.tenantId }
        });

        const stats = {
            totalSales: 0,
            totalPurchase: 0,
            totalInvoices: 0,
            productCount: products.length,
            activeCompanies: companies.length,
            pendingDespatches: 0,
            bankBalance: 0,
            cashBalance: 0,
            ccSpend: 0,
            totalExpenses: 0,
            topCompanies: [],
            salesTrend: {},
            purchaseTrend: {}
        };

        const companySales = {};

        // Belge Verileri
        invoices.forEach(inv => {
            const rawType = (inv.type || '').toUpperCase();
            const docType = (inv.docType || '').toUpperCase();
            const status = (inv.status || '').toUpperCase();
            
            if (status === 'DRAFT' || status === 'CANCELLED') return;
            // Sadece FATURA olanları toplamlara ekle, İrsaliyeleri geç (çift sayılmasın)
            if (docType !== 'INVOICE') return;

            const amount = parseFloat(inv.totalAmount) || 0;
            const date = inv.date ? new Date(inv.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

            if (rawType.includes('SALES') || rawType.includes('SATIS')) {
                stats.totalSales += amount;
                stats.salesTrend[date] = (stats.salesTrend[date] || 0) + amount;
                companySales[inv.companyId] = (companySales[inv.companyId] || 0) + amount;
            } else if (rawType.includes('PURCHASE') || rawType.includes('ALIS')) {
                stats.totalPurchase += amount;
                stats.purchaseTrend[date] = (stats.purchaseTrend[date] || 0) + amount;
            } else if (rawType.includes('RETURN') || rawType.includes('IADE')) {
                stats.totalSales -= amount;
            }
            
            stats.totalInvoices++;
        });

        // Kasa/Banka Verileri
        let methods = [];
        try {
            if (prisma.paymentMethod) {
                methods = await prisma.paymentMethod.findMany({ where: { tenantId: req.user.tenantId } });
            }
        } catch (dbErr) {
            console.warn('PaymentMethod lookup failed, using fallback.');
        }
        
        console.log(`[STATS] Processing ${invoices.length} invoices and ${cashTransactions.length} cash txs.`);

        cashTransactions.forEach(tx => {
            const amount = parseFloat(tx.amount) || 0;
            const type = (tx.type || '').toUpperCase();
            
            // Hesabın türünü bul (Nakit mi, Banka mı?)
            const method = methods.find(m => m.name === tx.accountType);
            let methodType = method ? method.type : (tx.accountType || '').toUpperCase();

            // Gelişmiş Fallback: İsimden tür tahmin et (Tablo senkronize değilse diye)
            if (!method) {
                const accName = (tx.accountType || '').toUpperCase();
                if (accName.includes('BANKA') || accName.includes('VAKIF') || accName.includes('ZIRAAT')) methodType = 'BANKA';
                else if (accName.includes('KART')) methodType = 'KREDI_KARTI';
                else if (accName.includes('KASA') || accName.includes('NAKIT')) methodType = 'KASA';
            }

            if (methodType === 'BANKA') {
                if (type === 'TAHSILAT' || type === 'GELIR' || type === 'DEVIR') stats.bankBalance += amount;
                else stats.bankBalance -= amount;
            } else if (methodType === 'KASA') {
                if (type === 'TAHSILAT' || type === 'GELIR' || type === 'DEVIR') stats.cashBalance += amount;
                else stats.cashBalance -= amount;
            } else if (methodType === 'KREDI_KARTI') {
                if (type === 'ODEME' || type === 'GIDER') stats.ccSpend += amount;
            }

            if (type === 'ODEME' || type === 'GIDER') {
                stats.totalExpenses += amount;
            }
        });

        stats.profitability = stats.totalSales - stats.totalPurchase - stats.totalExpenses;

        // Grafik 30 Gün
        const today = new Date();
        for(let i=29; i>=0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dStr = d.toISOString().split('T')[0];
            if(!stats.salesTrend[dStr]) stats.salesTrend[dStr] = 0;
        }

        stats.topCompanies = Object.entries(companySales).map(([code, total]) => {
            const comp = companies.find(c => c.cariKod === code || c.ad === code);
            return { code, name: comp ? comp.ad : code, total, count: invoices.filter(i => i.companyId === code).length };
        }).sort((a,b) => b.total - a.total).slice(0,10);

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
