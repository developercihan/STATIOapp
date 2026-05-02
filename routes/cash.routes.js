const express = require('express');
const router = express.Router();
const prisma = require('../services/db.service');
const { requireLogin, requirePermission, csrfCheck } = require('../middlewares/auth.middleware');
const { makeId } = require('../utils/helpers');

// GET /api/admin/cash-transactions
router.get('/admin/cash-transactions', requireLogin, async (req, res) => {
    try {
        const transactions = await prisma.cashTransaction.findMany({
            where: { tenantId: req.user.tenantId },
            orderBy: { date: 'desc' }
        });
        
        const companies = await prisma.company.findMany({
            where: { tenantId: req.user.tenantId }
        });
        
        // Firma adlarını eşleştir
        const txWithNames = transactions.map(t => {
            const comp = companies.find(c => c.cariKod === t.cariCode);
            return { ...t, companyName: comp ? comp.ad : t.cariCode };
        });

        res.json(txWithNames);
    } catch (e) {
        console.error('Cash transactions fetch error:', e);
        res.status(500).json({ error: 'Kasa işlemleri okunamadı' });
    }
});

// POST /api/admin/cash-transactions
router.post('/admin/cash-transactions', requireLogin, csrfCheck, async (req, res) => {
    try {
        let { type, cariCode, amount, accountType, receiptCode, date, notes } = req.body;
        cariCode = cariCode.toUpperCase().trim();
        const trAmount = parseFloat(amount) || 0;
        const multiplier = (type === 'TAHSILAT') ? -1 : 1;
        const balanceChange = trAmount * multiplier;

        const result = await prisma.$transaction(async (tx) => {
            // 1. Kasa işlemini kaydet
            const newCashTr = await tx.cashTransaction.create({
                data: {
                    type,
                    cariCode,
                    amount: trAmount,
                    accountType,
                    receiptCode,
                    date: date ? new Date(date) : new Date(),
                    notes: notes || '',
                    tenantId: req.user.tenantId,
                    createdBy: req.user.username
                }
            });

            // 2. Cariyi bul veya oluştur
            let rcv = await tx.receivable.findUnique({
                where: { code_tenantId: { code: cariCode, tenantId: req.user.tenantId } }
            });

            if (!rcv) {
                const compInfo = await tx.company.findUnique({
                    where: { cariKod_tenantId: { cariKod: cariCode, tenantId: req.user.tenantId } }
                });
                rcv = await tx.receivable.create({
                    data: {
                        code: cariCode,
                        companyName: cariCode === 'SISTEM' ? 'SİSTEM AÇILIŞ' : (compInfo ? compInfo.ad : cariCode),
                        balance: 0,
                        riskLimit: compInfo ? (compInfo.riskLimit || 0) : 0,
                        status: 'AKTIF',
                        tenantId: req.user.tenantId
                    }
                });
            }

            const newBalance = (parseFloat(rcv.balance) || 0) + balanceChange;

            // 3. Cari hareket ekle
            await tx.transaction.create({
                data: {
                    receivableId: rcv.id,
                    date: date ? new Date(date) : new Date(),
                    description: `${type === 'TAHSILAT' ? 'Tahsilat' : 'Ödeme'} (${accountType}) - Fiş: ${receiptCode}`,
                    relatedId: newCashTr.id,
                    amount: balanceChange,
                    type: type,
                    balanceAfter: newBalance
                }
            });

            // 4. Cari bakiyeyi güncelle
            await tx.receivable.update({
                where: { id: rcv.id },
                data: { balance: newBalance, updatedAt: new Date() }
            });

            return newCashTr;
        });

        res.json({ message: 'İşlem başarıyla kaydedildi', transaction: result });
    } catch (e) {
        console.error('Kasa işlem hatası:', e);
        res.status(500).json({ error: 'İşlem kaydedilemedi' });
    }
});

// PUT /api/admin/cash-transactions/:id
router.put('/admin/cash-transactions/:id', requireLogin, csrfCheck, async (req, res) => {
    try {
        const { type, cariCode, amount, accountType, receiptCode, date, notes } = req.body;
        
        await prisma.$transaction(async (tx) => {
            const oldTx = await tx.cashTransaction.findUnique({
                where: { id: req.params.id, tenantId: req.user.tenantId }
            });
            if (!oldTx) throw new Error('İşlem bulunamadı');

            // 1. Eski cari bakiyesini geri al
            const oldRcv = await tx.receivable.findUnique({
                where: { code_tenantId: { code: oldTx.cariCode, tenantId: req.user.tenantId } }
            });
            if (oldRcv) {
                const oldMult = (oldTx.type === 'TAHSILAT') ? -1 : 1;
                const oldBalanceChange = oldTx.amount * oldMult;
                
                await tx.receivable.update({
                    where: { id: oldRcv.id },
                    data: { balance: { decrement: oldBalanceChange } }
                });
                await tx.transaction.deleteMany({
                    where: { receivableId: oldRcv.id, relatedId: oldTx.id }
                });
            }

            // 2. Kasa işlemini güncelle
            const updatedTx = await tx.cashTransaction.update({
                where: { id: req.params.id },
                data: {
                    type,
                    cariCode,
                    amount: parseFloat(amount),
                    accountType,
                    receiptCode,
                    date: date ? new Date(date) : new Date(),
                    notes,
                    updatedAt: new Date()
                }
            });

            // 3. Yeni cari bakiyesini işle
            let newRcv = await tx.receivable.findUnique({
                where: { code_tenantId: { code: cariCode, tenantId: req.user.tenantId } }
            });
            if (newRcv) {
                const newMult = (type === 'TAHSILAT') ? -1 : 1;
                const newBalanceChange = parseFloat(amount) * newMult;
                const newBalance = (parseFloat(newRcv.balance) || 0) + newBalanceChange;

                await tx.receivable.update({
                    where: { id: newRcv.id },
                    data: { balance: newBalance }
                });
                await tx.transaction.create({
                    data: {
                        receivableId: newRcv.id,
                        date: date ? new Date(date) : new Date(),
                        description: `DÜZELTME: ${type === 'TAHSILAT' ? 'Tahsilat' : 'Ödeme'} (${accountType}) - Fiş: ${receiptCode}`,
                        relatedId: updatedTx.id,
                        amount: newBalanceChange,
                        type: type,
                        balanceAfter: newBalance
                    }
                });
            }
        });

        res.json({ message: 'İşlem güncellendi' });
    } catch (e) { 
        console.error('Update error:', e);
        res.status(500).json({ error: 'Güncelleme hatası' }); 
    }
});

router.delete('/admin/cash-transactions/:id', requireLogin, csrfCheck, async (req, res) => {
    try {
        await prisma.$transaction(async (tx) => {
            const cashTx = await tx.cashTransaction.findUnique({
                where: { id: req.params.id, tenantId: req.user.tenantId }
            });
            if (!cashTx) throw new Error('İşlem bulunamadı');

            // 1. Cari Bakiyesini Geri Al
            const rcv = await tx.receivable.findUnique({
                where: { code_tenantId: { code: cashTx.cariCode, tenantId: req.user.tenantId } }
            });
            if (rcv) {
                const multiplier = (cashTx.type === 'TAHSILAT') ? -1 : 1;
                const balanceChange = cashTx.amount * multiplier;
                
                await tx.receivable.update({
                    where: { id: rcv.id },
                    data: { balance: { decrement: balanceChange } }
                });
                await tx.transaction.deleteMany({
                    where: { receivableId: rcv.id, relatedId: cashTx.id }
                });
            }

            // 2. Kasa işlemini sil
            await tx.cashTransaction.delete({
                where: { id: req.params.id }
            });
        });

        res.json({ message: 'İşlem silindi ve bakiye düzeltildi' });
    } catch (e) { 
        console.error('Delete error:', e);
        res.status(500).json({ error: 'Silme hatası' }); 
    }
});

module.exports = router;
