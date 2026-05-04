const express = require('express');
const router = express.Router();
const prisma = require('../services/db.service');
const { requireLogin, requireRole } = require('../middlewares/auth.middleware');

router.get('/dashboard', requireLogin, requireRole('admin'), async (req, res) => {
    try {
        const [invoices, products, companies, cashTransactions, methods] = await Promise.all([
            prisma.invoice.findMany({
                where: { tenantId: req.user.tenantId }
            }),
            prisma.product.findMany({
                where: { tenantId: req.user.tenantId }
            }),
            prisma.company.findMany({
                where: { tenantId: req.user.tenantId }
            }),
            prisma.cashTransaction.findMany({
                where: { tenantId: req.user.tenantId }
            }),
            prisma.paymentMethod ? prisma.paymentMethod.findMany({ where: { tenantId: req.user.tenantId } }) : Promise.resolve([])
        ]);

        const stats = {
            totalSales: 0,
            totalPurchase: 0,
            totalInvoices: 0,
            productCount: products.length,
            activeCompanies: companies.length,
            pendingDespatches: 0,
            bankBalance: 0,
            cashBalance: 0,
            senetBalance: 0, // Yeni: Senet Bakiyesi
            ccSpend: 0,
            totalExpenses: 0,
            totalExtraIncome: 0, // Yeni: Ek gelirler (fatura dışı)
            topCompanies: [],
            salesTrend: {},
            purchaseTrend: {}
        };

        const companySales = {};

        // Belge Verileri (Ticari Kar/Zarar Temeli)
        invoices.forEach(inv => {
            const rawType = (inv.type || '').toUpperCase();
            const docType = (inv.docType || '').toUpperCase();
            const status = (inv.status || '').toUpperCase();
            
            if (status === 'DRAFT' || status === 'CANCELLED') return;
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

        // Kasa/Banka/Senet Verileri (Nakit Akışı ve Operasyonel Giderler)
        // (Methods were fetched parallelly at start)
        
        cashTransactions.forEach(tx => {
            const amount = parseFloat(tx.amount) || 0;
            const type = (tx.type || '').toUpperCase();
            
            const method = methods.find(m => m.name === tx.accountType);
            let methodType = method ? (method.type || '').toUpperCase() : (tx.accountType || '').toUpperCase();

            // Gelişmiş Tür Tahmini (Kullanıcı PaymentMethod tipini yanlış seçmiş olsa bile düzeltir)
            const accName = (tx.accountType || '').toUpperCase();
            if (accName.includes('BANKA') || accName.includes('VAKIF') || accName.includes('ZIRAAT') || methodType === 'BANKA') {
                methodType = 'BANKA';
                if (type === 'TAHSILAT' || type === 'GELIR' || type === 'DEVIR') stats.bankBalance += amount;
                else stats.bankBalance -= amount;
            } else if (accName.includes('KASA') || accName.includes('NAKIT') || methodType === 'KASA') {
                methodType = 'KASA';
                if (type === 'TAHSILAT' || type === 'GELIR' || type === 'DEVIR') stats.cashBalance += amount;
                else stats.cashBalance -= amount;
            } else if (accName.includes('SENET') || accName.includes('CEK') || accName.includes('ÇEK') || methodType === 'SENET') {
                methodType = 'SENET';
                // Senet/Çek girişi (Tahsilat) portföyü artırır, ödenmesi veya çıkılması azaltır
                if (type === 'TAHSILAT' || type === 'GELIR' || type === 'DEVIR') stats.senetBalance += amount;
                else stats.senetBalance -= amount;
            } else if (accName.includes('KART') || methodType === 'KREDI_KARTI') {
                methodType = 'KREDI_KARTI';
                if (type === 'ODEME' || type === 'GIDER') stats.ccSpend += amount;
            }

            // Operasyonel Karlılık Takibi
            if (type === 'ODEME' || type === 'GIDER') {
                stats.totalExpenses += amount;
            } else if (type === 'GELIR') {
                stats.totalExtraIncome += amount;
            }
        });

        // HESAPLAMA: (Satış - Alış) + Ek Gelirler - Giderler
        stats.profitability = (stats.totalSales - stats.totalPurchase) + stats.totalExtraIncome - stats.totalExpenses;

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
