const express = require('express');
const router = express.Router();
const dataAccess = require('../services/dataAccess');
const { requireLogin, requirePermission, csrfCheck } = require('../middlewares/auth.middleware');
const { makeId } = require('../utils/helpers');

// GET /api/admin/cash-transactions
router.get('/admin/cash-transactions', requireLogin, async (req, res) => {
    try {
        const [transactions, companies] = await Promise.all([
            dataAccess.readJson('cash_transactions.json', req.user.tenantId),
            dataAccess.readJson('companies.json', req.user.tenantId)
        ]);
        
        // Firma adlarını eşleştir
        const txWithNames = transactions.map(t => {
            const comp = companies.find(c => c.cariKod === t.cariCode);
            return { ...t, companyName: comp ? comp.ad : t.cariCode };
        });

        res.json(txWithNames.sort((a,b) => new Date(b.date) - new Date(a.date)));
    } catch (e) {
        res.status(500).json({ error: 'Kasa işlemleri okunamadı' });
    }
});

// POST /api/admin/cash-transactions
router.post('/admin/cash-transactions', requireLogin, csrfCheck, async (req, res) => {
    try {
        let { type, cariCode, amount, accountType, receiptCode, date, notes } = req.body;
        cariCode = cariCode.toUpperCase().trim(); // Normalizasyon
        
        // 1. Kasa işlemini kaydet
        const cashTransactions = await dataAccess.readJson('cash_transactions.json', req.user.tenantId);
        const newCashTr = {
            id: makeId('cash'),
            type,
            cariCode,
            amount: parseFloat(amount) || 0,
            accountType,
            receiptCode,
            date: date || new Date().toISOString(),
            notes: notes || '',
            createdAt: new Date().toISOString(),
            createdBy: req.user.username
        };
        cashTransactions.push(newCashTr);
        await dataAccess.writeJson('cash_transactions.json', cashTransactions, req.user.tenantId);

        // 2. Cari bakiyesini ve ekstresini güncelle
        const [receivables, companies] = await Promise.all([
            dataAccess.readJson('receivables.json', req.user.tenantId),
            dataAccess.readJson('companies.json', req.user.tenantId)
        ]);
        
        let rIdx = receivables.findIndex(r => r.code.toUpperCase() === cariCode);
        
        // Eğer cari hesap ekstresi henüz yoksa otomatik OLUŞTUR
        if (rIdx === -1) {
            const compInfo = companies.find(c => c.cariKod.toUpperCase() === cariCode);
            const newRcv = {
                id: makeId('rcv'),
                code: cariCode,
                companyName: compInfo ? compInfo.ad : cariCode,
                balance: 0,
                riskLimit: compInfo ? (compInfo.riskLimit || 0) : 0,
                status: 'AKTIF',
                transactions: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            receivables.push(newRcv);
            rIdx = receivables.length - 1;
        }

        const trAmount = parseFloat(amount) || 0;
        const multiplier = (type === 'TAHSILAT') ? -1 : 1;
        const balanceChange = trAmount * multiplier;
        
        receivables[rIdx].balance = (parseFloat(receivables[rIdx].balance) || 0) + balanceChange;
        
        if (!receivables[rIdx].transactions) receivables[rIdx].transactions = [];
        receivables[rIdx].transactions.push({
            id: makeId('tr'),
            date: date || new Date().toISOString(),
            description: `${type === 'TAHSILAT' ? 'Tahsilat' : 'Ödeme'} (${accountType}) - Fiş: ${receiptCode}`,
            relatedId: newCashTr.id,
            amount: balanceChange,
            type: type,
            balanceAfter: receivables[rIdx].balance
        });
        
        receivables[rIdx].updatedAt = new Date().toISOString();
        await dataAccess.writeJson('receivables.json', receivables, req.user.tenantId);

        res.json({ message: 'İşlem başarıyla kaydedildi', transaction: newCashTr });
    } catch (e) {
        console.error('Kasa işlem hatası:', e);
        res.status(500).json({ error: 'İşlem kaydedilemedi' });
    }
});

// PUT /api/admin/cash-transactions/:id
router.put('/admin/cash-transactions/:id', requireLogin, csrfCheck, async (req, res) => {
    try {
        const { type, cariCode, amount, accountType, receiptCode, date, notes } = req.body;
        const txs = await dataAccess.readJson('cash_transactions.json', req.user.tenantId);
        const idx = txs.findIndex(t => t.id === req.params.id);
        if (idx === -1) return res.status(404).json({ error: 'İşlem bulunamadı' });

        const oldTx = { ...txs[idx] };
        txs[idx] = { ...txs[idx], type, cariCode, amount: parseFloat(amount), accountType, receiptCode, date, notes, updatedAt: new Date().toISOString() };
        await dataAccess.writeJson('cash_transactions.json', txs, req.user.tenantId);

        // Cari Bakiyesini Güncelle (Önce eskiyi geri al, sonra yeniyi ekle)
        const receivables = await dataAccess.readJson('receivables.json', req.user.tenantId);
        
        // 1. Eski cariyi bul ve eski işlemi geri al
        const oldRcvIdx = receivables.findIndex(r => r.code === oldTx.cariCode);
        if (oldRcvIdx !== -1) {
            const oldMult = (oldTx.type === 'TAHSILAT') ? -1 : 1;
            receivables[oldRcvIdx].balance -= (oldTx.amount * oldMult);
            receivables[oldRcvIdx].transactions = (receivables[oldRcvIdx].transactions || []).filter(t => t.relatedId !== oldTx.id);
        }

        // 2. Yeni cariyi bul (aynı da olabilir farklı da) ve yeni işlemi işle
        const newRcvIdx = receivables.findIndex(r => r.code === cariCode);
        if (newRcvIdx !== -1) {
            const newMult = (type === 'TAHSILAT') ? -1 : 1;
            const balanceChange = parseFloat(amount) * newMult;
            receivables[newRcvIdx].balance += balanceChange;
            
            if (!receivables[newRcvIdx].transactions) receivables[newRcvIdx].transactions = [];
            receivables[newRcvIdx].transactions.push({
                id: makeId('tr'),
                date: date || new Date().toISOString(),
                description: `DÜZELTME: ${type === 'TAHSILAT' ? 'Tahsilat' : 'Ödeme'} (${accountType}) - Fiş: ${receiptCode}`,
                relatedId: req.params.id,
                amount: balanceChange,
                type: type,
                balanceAfter: receivables[newRcvIdx].balance
            });
        }
        
        await dataAccess.writeJson('receivables.json', receivables, req.user.tenantId);
        res.json({ message: 'İşlem güncellendi' });
    } catch (e) { res.status(500).json({ error: 'Güncelleme hatası' }); }
});

// DELETE /api/admin/cash-transactions/:id
router.post('/admin/cash-transactions/delete/:id', requireLogin, csrfCheck, async (req, res) => { // Using POST for safety or just DELETE
    // I'll use standard DELETE below
});

router.delete('/admin/cash-transactions/:id', requireLogin, csrfCheck, async (req, res) => {
    try {
        let txs = await dataAccess.readJson('cash_transactions.json', req.user.tenantId);
        const tx = txs.find(t => t.id === req.params.id);
        if (!tx) return res.status(404).json({ error: 'İşlem bulunamadı' });

        txs = txs.filter(t => t.id !== req.params.id);
        await dataAccess.writeJson('cash_transactions.json', txs, req.user.tenantId);

        // Cari Bakiyesini Geri Al
        const receivables = await dataAccess.readJson('receivables.json', req.user.tenantId);
        const rIdx = receivables.findIndex(r => r.code === tx.cariCode);
        if (rIdx !== -1) {
            const multiplier = (tx.type === 'TAHSILAT') ? -1 : 1;
            receivables[rIdx].balance -= (tx.amount * multiplier);
            receivables[rIdx].transactions = (receivables[rIdx].transactions || []).filter(t => t.relatedId !== tx.id);
            await dataAccess.writeJson('receivables.json', receivables, req.user.tenantId);
        }

        res.json({ message: 'İşlem silindi ve bakiye düzeltildi' });
    } catch (e) { res.status(500).json({ error: 'Silme hatası' }); }
});

module.exports = router;
