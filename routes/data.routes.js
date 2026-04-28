const express = require('express');
const router = express.Router();
const path = require('path');
const dataAccess = require('../services/dataAccess');
const { requireLogin, requirePermission, requireRole, hasPermission } = require('../middlewares/auth.middleware');
const { makeId } = require('../utils/helpers');
const pdfService = require('../services/pdf.service');
const xmlService = require('../services/xml.service');
const fs = require('fs');

// GET /api/products
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
    } catch (e) { res.status(500).json({ error: 'Ürünler okunamadı' }); }
});

// GET /api/distributors
router.get('/distributors', requireLogin, async (req, res) => {
    try {
        const dists = await dataAccess.readJson('distributors.json', req.user.tenantId);
        res.json(dists);
    } catch (e) { res.status(500).json({ error: 'Distribütörler okunamadı' }); }
});

// GET /api/companies
router.get('/companies', requireLogin, async (req, res) => {
    try {
        const comps = await dataAccess.readJson('companies.json', req.user.tenantId);
        res.json(comps);
    } catch (e) { res.status(500).json({ error: 'Kurumlar okunamadı' }); }
});

// --- BÖLÜM 5: DEPO VE EVRAK (İRSALİYE/FATURA) MODÜLÜ ---

// GET /api/orders
router.get('/orders', requireLogin, async (req, res) => {
    try {
        let orders = await dataAccess.readJson('orders.json', req.user.tenantId);

        // YETKİ KONTROLÜ
        if (req.user.role === 'distributor') {
            orders = orders.filter(o => o.createdBy === req.user.id || o.distributorCode === req.user.username);
        } else if (req.user.role === 'warehouse') {
            if (req.user.warehouseId) {
                orders = orders.filter(o => o.warehouseId === req.user.warehouseId);
            } else {
                orders = [];
            }
        }

        if (req.query.status) orders = orders.filter(o => o.status === req.query.status);
        if (req.query.distributorCode) orders = orders.filter(o => o.distributorCode === req.query.distributorCode);
        if (req.query.companyCode) orders = orders.filter(o => o.companyCode === req.query.companyCode);

        res.json(orders);
    } catch (e) {
        res.status(500).json({ error: 'Siparişler okunamadı' });
    }
});

// POST /api/orders
router.post('/orders', requireLogin, async (req, res) => {
    try {
        const { distributorCode, companyCode, items, orderType, notes } = req.body;

        const orders = await dataAccess.readJson('orders.json', req.user.tenantId);

        // ID Generation
        const year = new Date().getFullYear();
        let maxNum = 0;
        orders.forEach(o => {
            const match = o.id.match(new RegExp(`${year}-(\\d+)`));
            if (match && parseInt(match[1]) > maxNum) maxNum = parseInt(match[1]);
        });
        const newOrderId = `ORD-${year}-${String(maxNum + 1).padStart(4, '0')}`;

        // Calculate Totals
        let totalAmount = 0;
        let totalTax = 0;
        let finalAmount = 0;

        items.forEach(item => {
            const pExcl = parseFloat(item.priceExclTax) || 0;
            const q = parseInt(item.miktar) || 0;
            const tRate = parseFloat(item.taxRate) || 0;
            const dRate = parseFloat(item.discountRate) || 0;

            const lineExcl = pExcl * q * (1 - (dRate / 100));
            const lineTax = lineExcl * (tRate / 100);

            item.lineTotalExcl = lineExcl;
            item.lineTax = lineTax;
            item.lineTotal = lineExcl + lineTax;

            totalAmount += lineExcl;
            totalTax += lineTax;
            finalAmount += item.lineTotal;
        });

        const newOrder = {
            id: newOrderId,
            distributorCode,
            companyCode,
            items,
            orderType: orderType || 'SIPARIS',
            status: 'YENI',
            warehouseId: null,
            totalAmount: totalAmount,
            totalTax: totalTax,
            finalAmount: finalAmount,
            notes: notes || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: req.user.id
        };

        // --- RİSK LİMİTİ KONTROLÜ ---
        try {
            const [receivables, companies] = await Promise.all([
                dataAccess.readJson('receivables.json', req.user.tenantId),
                dataAccess.readJson('companies.json', req.user.tenantId)
            ]);
            
            const rcv = receivables.find(r => r.code === companyCode);
            const comp = companies.find(c => c.cariKod === companyCode);
            
            // Limiti hem cariden hem kurumdan kontrol et (en güncel olanı al)
            const riskLimit = parseFloat(comp ? comp.riskLimit : (rcv ? rcv.riskLimit : 0)) || 0;
            
            if (riskLimit > 0) {
                const currentBalance = parseFloat(rcv ? rcv.balance : 0) || 0;
                const totalNewBalance = currentBalance + finalAmount;
                
                if (totalNewBalance > riskLimit) {
                    const excess = totalNewBalance - riskLimit;
                    return res.status(400).json({ 
                        error: `RİSK LİMİTİ AŞILDI! \n\nMüşteri: ${comp ? comp.ad : companyCode}\n\nMevcut Borç: ${currentBalance.toFixed(2)} TL\nYeni Sipariş: ${finalAmount.toFixed(2)} TL\nToplam: ${totalNewBalance.toFixed(2)} TL\n\nTanımlı Limit: ${riskLimit.toFixed(2)} TL\n\nLimit Aşım Tutarı: ${excess.toFixed(2)} TL\n\nSipariş bu limitler dahilinde onaylanamaz.` 
                    });
                }
            }
        } catch (err) { console.error('Risk kontrol hata:', err); }

        orders.push(newOrder);
        await dataAccess.writeJson('orders.json', orders, req.user.tenantId);

        // --- CARİ HAREKET EKLEME KALDIRILDI (Teslimat aşamasına taşındı) ---

        await dataAccess.appendAuditLog({
            ts: new Date().toISOString(),
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role,
            action: 'ORDER_CREATED',
            entityType: 'order',
            entityId: newOrder.id,
            details: { itemCount: items.length }
        }, req.user.tenantId);

        // Örnek bildirim entegrasyonu (nodemailer) eksik - ilerde services üzerinden aktarılır

        res.json({ message: 'Sipariş oluşturuldu', orderId: newOrder.id });
    } catch (e) {
        res.status(500).json({ error: 'Sipariş oluşturulamadı' });
    }
});

// GET /api/orders/:id
router.get('/orders/:id', requireLogin, async (req, res) => {
    const orders = await dataAccess.readJson('orders.json', req.user.tenantId);
    const order = orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı' });

    // YETKİ KONTROLÜ
    if (req.user.role === 'distributor' && order.createdBy !== req.user.id && order.distributorCode !== req.user.username) {
        return res.status(403).json({ error: 'Bu siparişi görme yetkiniz yok' });
    }
    if (req.user.role === 'warehouse' && order.warehouseId !== req.user.warehouseId) {
        return res.status(403).json({ error: 'Bu sipariş size atanmamış' });
    }

    res.json(order);
});

// DELETE /api/orders/:id
router.delete('/orders/:id', requireLogin, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Bu işlem için yönetici yetkisi gereklidir.' });

        const orders = await dataAccess.readJson('orders.json', req.user.tenantId);
        const filtered = orders.filter(o => o.id !== req.params.id);

        await dataAccess.writeJson('orders.json', filtered, req.user.tenantId);
        res.json({ message: 'Sipariş başarıyla silindi' });
    } catch (e) {
        res.status(500).json({ error: 'Silme hatası: ' + e.message });
    }
});

// POST /api/orders/bulk-delete
router.post('/orders/bulk-delete', requireLogin, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Yönetici yetkisi gereklidir.' });
        const { ids } = req.body;
        let orders = await dataAccess.readJson('orders.json', req.user.tenantId);
        orders = orders.filter(o => !ids.includes(o.id));
        await dataAccess.writeJson('orders.json', orders, req.user.tenantId);
        res.json({ message: 'Seçili siparişler silindi' });
    } catch (e) { res.status(500).json({ error: 'Toplu silme hatası: ' + e.message }); }
});

// PUT /api/orders/:id
router.put('/orders/:id', requireLogin, requirePermission('orders.edit'), async (req, res) => {
    try {
        const orders = await dataAccess.readJson('orders.json', req.user.tenantId);
        const index = orders.findIndex(o => o.id === req.params.id);
        if (index === -1) return res.status(404).json({ error: 'Sipariş bulunamadı' });

        const updates = req.body;
        const validStatuses = ['YENI', 'ATANDI', 'HAZIRLANIYOR', 'KARGODA', 'TESLIM_EDILDI', 'IPTAL_EDILDI'];
        if (updates.status && !validStatuses.includes(updates.status)) {
            return res.status(400).json({ error: 'Geçersiz durum' });
        }

        if (updates.items && Array.isArray(updates.items)) {
            let totalAmount = 0;
            let totalTax = 0;
            let finalAmount = 0;

            updates.items.forEach(item => {
                const pExcl = parseFloat(item.priceExclTax) || 0;
                const q = parseInt(item.miktar) || 0;
                const tRate = parseFloat(item.taxRate) || 0;
                const dRate = parseFloat(item.discountRate) || 0;

                const lineExcl = pExcl * q * (1 - (dRate / 100));
                const lineTax = lineExcl * (tRate / 100);

                item.lineTotalExcl = lineExcl;
                item.lineTax = lineTax;
                item.lineTotal = lineExcl + lineTax;

                totalAmount += lineExcl;
                totalTax += lineTax;
                finalAmount += item.lineTotal;
            });

            updates.totalAmount = totalAmount;
            updates.totalTax = totalTax;
            updates.finalAmount = finalAmount;
        }

        const oldStatus = orders[index].status;
        const newStatus = updates.status;

        // Stock management logic
        if (newStatus === 'IPTAL_EDILDI' && oldStatus !== 'IPTAL_EDILDI' && oldStatus !== 'YENI' && oldStatus !== 'ATANDI') {
            await adjustStock(orders[index].items, 1, req.user.tenantId);
        } else if ((newStatus === 'HAZIRLANIYOR' || newStatus === 'KARGODA') && (oldStatus === 'YENI' || oldStatus === 'ATANDI')) {
            await adjustStock(orders[index].items, -1, req.user.tenantId);
        }

        orders[index] = { ...orders[index], ...updates, updatedAt: new Date().toISOString() };
        await dataAccess.writeJson('orders.json', orders, req.user.tenantId);

        await dataAccess.appendAuditLog({
            ts: new Date().toISOString(),
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role,
            action: 'ORDER_UPDATED',
            entityType: 'order',
            entityId: orders[index].id,
            details: { updates }
        }, req.user.tenantId);

        res.json({ message: 'Sipariş güncellendi', order: orders[index] });

        // Teslim edildi ise cariye işle
        if (newStatus === 'TESLIM_EDILDI' && oldStatus !== 'TESLIM_EDILDI') {
            await addCariDebt(orders[index], req.user.tenantId);
        } else if (oldStatus === 'TESLIM_EDILDI' && newStatus !== 'TESLIM_EDILDI') {
            // Durum geri çekildi ise cariden borcu sil
            await removeCariDebt(orders[index], req.user.tenantId);
        }
    } catch (e) {
        res.status(500).json({ error: 'Sipariş güncellenemedi' });
    }
});

// GET /api/orders/:id/pdf
router.get('/orders/:id/pdf', requireLogin, async (req, res) => {
    const orders = await dataAccess.readJson('orders.json', req.user.tenantId);
    const order = orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Siparis_${order.id}.pdf`);

    await pdfService.generateOrderPdf(order, res, req.user.tenantId);
});

// GET /api/orders/:id/print
router.get('/orders/:id/print', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'preview.html'));
});

// GET /api/orders/:id/timeline
router.get('/orders/:id/timeline', requireLogin, async (req, res) => {
    const logs = await dataAccess.readJson('audit_logs.json');
    const orderLogs = logs.filter(l => l.entityId === req.params.id && l.tenantId === req.user.tenantId);
    res.json(orderLogs);
});

// POST /api/orders/:id/assign
router.post('/orders/:id/assign', requireLogin, requirePermission('orders.assign'), async (req, res) => {
    try {
        const { warehouseId } = req.body;
        const orders = await dataAccess.readJson('orders.json', req.user.tenantId);
        const index = orders.findIndex(o => o.id === req.params.id);
        if (index === -1) return res.status(404).json({ error: 'Sipariş bulunamadı' });

        orders[index].warehouseId = warehouseId;
        orders[index].status = 'ATANDI';
        orders[index].updatedAt = new Date().toISOString();

        await dataAccess.writeJson('orders.json', orders, req.user.tenantId);

        await dataAccess.appendAuditLog({
            ts: new Date().toISOString(),
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role,
            action: 'ORDER_ASSIGNED',
            entityType: 'order',
            entityId: orders[index].id,
            details: { warehouseId }
        }, req.user.tenantId);

        res.json({ message: 'Depoya atandı' });
    } catch (e) {
        res.status(500).json({ error: 'Atama hatası' });
    }
});

// POST /api/orders/assign-bulk
router.post('/orders/assign-bulk', requireLogin, requirePermission('orders.assign'), async (req, res) => {
    try {
        const { orderIds, warehouseId } = req.body;
        if (!Array.isArray(orderIds)) return res.status(400).json({ error: 'orderIds dizisi hatalı' });

        const orders = await dataAccess.readJson('orders.json', req.user.tenantId);
        let updatedCount = 0;

        orderIds.forEach(id => {
            const index = orders.findIndex(o => o.id === id);
            if (index !== -1) {
                orders[index].warehouseId = warehouseId;
                orders[index].status = 'ATANDI';
                orders[index].updatedAt = new Date().toISOString();
                updatedCount++;
            }
        });

        await dataAccess.writeJson('orders.json', orders, req.user.tenantId);
        res.json({ message: `${updatedCount} sipariş atandı` });
    } catch (e) {
        res.status(500).json({ error: 'Toplu atama hatası' });
    }
});

// PUT /api/orders/:id/warehouse-status
router.put('/orders/:id/warehouse-status', requireLogin, async (req, res) => {
    try {
        const { status, cargoDetail } = req.body;
        const validStatuses = ['HAZIRLANIYOR', 'KARGODA', 'TESLIM_EDILDI'];
        if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Geçersiz depo durumu' });

        const orders = await dataAccess.readJson('orders.json', req.user.tenantId);
        const index = orders.findIndex(o => o.id === req.params.id);
        if (index === -1) return res.status(404).json({ error: 'Sipariş bulunamadı' });

        // Yetki kontrolü: Sadece ilgili depo veya admin
        if (req.user.role !== 'admin' && orders[index].warehouseId !== req.user.warehouseId) {
            return res.status(403).json({ error: 'Bu sipariş size atanmamış' });
        }

        const oldStatus = orders[index].status;

        // Stock deduction logic
        if ((status === 'HAZIRLANIYOR' || status === 'KARGODA') && (oldStatus === 'YENI' || oldStatus === 'ATANDI')) {
            await adjustStock(orders[index].items, -1, req.user.tenantId);
        }

        orders[index].status = status;
        if (status === 'KARGODA' && cargoDetail) {
            orders[index].cargoDetail = cargoDetail;
        }
        orders[index].updatedAt = new Date().toISOString();
        await dataAccess.writeJson('orders.json', orders, req.user.tenantId);

        await dataAccess.appendAuditLog({
            ts: new Date().toISOString(),
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role,
            action: 'ORDER_STATUS_CHANGED',
            entityType: 'order',
            entityId: req.params.id,
            details: { status, cargoDetail }
        }, req.user.tenantId);

        res.json({ message: 'Durum güncellendi' });

        // Teslim edildi ise cariye işle
        if (status === 'TESLIM_EDILDI' && oldStatus !== 'TESLIM_EDILDI') {
            await addCariDebt(orders[index], req.user.tenantId);
        } else if (oldStatus === 'TESLIM_EDILDI' && status !== 'TESLIM_EDILDI') {
            // Teslimat geri çekildi
            await removeCariDebt(orders[index], req.user.tenantId);
        }
    } catch (e) { res.status(500).json({ error: 'Durum güncellenemedi' }); }
});

// GET /api/orders/export.csv
router.get('/orders/export.csv', requireRole('admin'), async (req, res) => {
    try {
        const orders = await dataAccess.readJson('orders.json', req.user.tenantId);
        let csv = 'ID,Distribütör,Kurum,Durum,Oluşturulma Tarihi\n';
        orders.forEach(o => {
            csv += `${o.id},${o.distributorCode},${o.companyCode},${o.status},${o.createdAt}\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=siparisler.csv');
        res.send('\uFEFF' + csv);
    } catch (e) {
        res.status(500).json({ error: 'CSV dışa aktarılamadı' });
    }
});

// --- BÖLÜM 5: DEPO VE EVRAK (İRSALİYE/FATURA) MODÜLÜ ---

// GET /api/warehouses
router.get('/warehouses', requireLogin, async (req, res) => {
    try {
        const warehouses = await dataAccess.readJson('warehouses.json', req.user.tenantId);
        if (req.user.role === 'admin') return res.json(warehouses);
        res.json(warehouses.filter(w => w.isActive));
    } catch (e) { res.status(500).json({ error: 'Depolar okunamadı' }); }
});

// POST /api/warehouses
router.post('/warehouses', requireLogin, requirePermission('warehouses.manage'), async (req, res) => {
    try {
        const { id, name, responsible } = req.body;
        if (!name) return res.status(400).json({ error: 'Depo adı zorunludur' });
        const warehouses = await dataAccess.readJson('warehouses.json', req.user.tenantId);
        const newWarehouse = {
            id: id || makeId('wh'),
            name,
            responsible: responsible || '',
            isActive: true,
            createdAt: new Date().toISOString()
        };
        warehouses.push(newWarehouse);
        await dataAccess.writeJson('warehouses.json', warehouses, req.user.tenantId);
        res.json({ message: 'Depo eklendi', warehouse: newWarehouse });
    } catch (e) { res.status(500).json({ error: 'Depo eklenemedi' }); }
});

// PUT /api/warehouses/:id
router.put('/warehouses/:id', requireLogin, requirePermission('warehouses.manage'), async (req, res) => {
    try {
        const { name, responsible, isActive } = req.body;
        const warehouses = await dataAccess.readJson('warehouses.json', req.user.tenantId);
        const index = warehouses.findIndex(w => w.id === req.params.id);
        if (index === -1) return res.status(404).json({ error: 'Depo bulunamadı' });
        if (name) warehouses[index].name = name;
        if (responsible !== undefined) warehouses[index].responsible = responsible;
        if (isActive !== undefined) warehouses[index].isActive = isActive;
        await dataAccess.writeJson('warehouses.json', warehouses, req.user.tenantId);
        res.json({ message: 'Depo güncellendi' });
    } catch (e) { res.status(500).json({ error: 'Depo güncellenemedi' }); }
});

// DELETE /api/warehouses/:id
router.delete('/warehouses/:id', requireLogin, requirePermission('warehouses.manage'), async (req, res) => {
    try {
        const warehouses = await dataAccess.readJson('warehouses.json', req.user.tenantId);
        const index = warehouses.findIndex(w => w.id === req.params.id);
        if (index === -1) return res.status(404).json({ error: 'Depo bulunamadı' });
        warehouses.splice(index, 1);
        await dataAccess.writeJson('warehouses.json', warehouses, req.user.tenantId);
        res.json({ message: 'Depo silindi' });
    } catch (e) { res.status(500).json({ error: 'Depo silinemedi' }); }
});

// --- FATURA VE İRSALİYE ÖZELLİKLERİ KULLANICI TALEBİYLE DEVRE DIŞI BIRAKILDI ---
/*
router.post('/orders/:id/delivery-note', ...
router.get('/orders/:id/delivery-note/pdf', ...
router.post('/orders/:id/invoice', ...
router.get('/orders/:id/invoice/pdf', ...
*/

// GET /api/admin/delivery-notes
router.get('/admin/delivery-notes', requireLogin, requirePermission('orders.create_delivery_notes'), async (req, res) => {
    try {
        const notes = await dataAccess.readJson('delivery_notes.json', req.user.tenantId);
        res.json(notes);
    } catch (e) {
        res.status(500).json({ error: 'İrsaliyeler okunamadı' });
    }
});

// GET /api/admin/invoices
router.get('/admin/invoices', requireLogin, requirePermission('orders.create_invoice'), async (req, res) => {
    try {
        const invoices = await dataAccess.readJson('invoices.json', req.user.tenantId);
        res.json(invoices);
    } catch (e) {
        res.status(500).json({ error: 'Faturalar okunamadı' });
    }
});
router.post('/admin/stock-adjust', requireLogin, requireRole('admin'), async (req, res) => {
    try {
        const { code, amount, type } = req.body; // type: 'add' or 'set'
        const products = await dataAccess.readJson('products.json', req.user.tenantId);
        const pIdx = products.findIndex(p => p.kod === code);
        if (pIdx === -1) return res.status(404).json({ error: 'Ürün bulunamadı' });

        if (type === 'set') {
            products[pIdx].stock = parseInt(amount);
        } else {
            products[pIdx].stock = (products[pIdx].stock || 0) + parseInt(amount);
        }

        await dataAccess.writeJson('products.json', products, req.user.tenantId);
        res.json({ message: 'Stok güncellendi', newStock: products[pIdx].stock });
    } catch (e) { res.status(500).json({ error: 'Stok güncellenemedi' }); }
});

async function adjustStock(items, multiplier, tenantId) {
    try {
        const products = await dataAccess.readJson('products.json', tenantId);

        items.forEach(item => {
            const pIdx = products.findIndex(p => p.kod === item.code);
            if (pIdx !== -1) {
                const qty = parseInt(item.qty) || parseInt(item.miktar) || 0;
                products[pIdx].stock = (products[pIdx].stock || 0) + (qty * multiplier);
            }
        });

        await dataAccess.writeJson('products.json', products, tenantId);
    } catch (e) {
        console.error('Stock adjustment error:', e);
    }
}

async function addCariDebt(order, tenantId) {
    try {
        const [receivables, companies] = await Promise.all([
            dataAccess.readJson('receivables.json', tenantId),
            dataAccess.readJson('companies.json', tenantId)
        ]);
        
        const compInfo = companies.find(c => c.cariKod === order.companyCode);
        const compName = compInfo ? compInfo.ad : order.companyCode;

        let rIdx = receivables.findIndex(r => r.code === order.companyCode);
        
        // Cari yoksa otomatik oluştur
        if (rIdx === -1) {
            const newCari = { 
                id: makeId('rcv'), 
                code: order.companyCode, 
                companyName: compName, 
                balance: 0, 
                riskLimit: compInfo ? (compInfo.riskLimit || 0) : 0,
                status: 'BORCLU', 
                source: 'auto-delivered', 
                transactions: [], 
                createdAt: new Date().toISOString(), 
                updatedAt: new Date().toISOString() 
            };
            receivables.push(newCari);
            rIdx = receivables.length - 1;
        } else {
            // Mevcut cariyi de senkronize et
            receivables[rIdx].companyName = compName;
            if (compInfo && compInfo.riskLimit) receivables[rIdx].riskLimit = compInfo.riskLimit;
        }

        if (!receivables[rIdx].transactions) receivables[rIdx].transactions = [];
        
        // Mükerrer kayıt kontrolü (Bu sipariş zaten işlenmiş mi?)
        const alreadyLogged = receivables[rIdx].transactions.some(t => t.relatedId === order.id);
        if (alreadyLogged) return;

        const amount = parseFloat(order.finalAmount) || 0;
        const newBalance = (parseFloat(receivables[rIdx].balance) || 0) + amount;

        receivables[rIdx].transactions.push({
            id: makeId('tr'),
            date: new Date().toISOString(),
            description: `Sipariş Teslim Edildi (#${order.id})`,
            relatedId: order.id,
            amount: amount,
            type: 'INVOICE',
            balanceAfter: newBalance
        });

        receivables[rIdx].balance = newBalance;
        receivables[rIdx].updatedAt = new Date().toISOString();
        
        await dataAccess.writeJson('receivables.json', receivables, tenantId);
    } catch (err) {
        console.error('addCariDebt Hatası:', err);
    }
}

async function removeCariDebt(order, tenantId) {
    try {
        const receivables = await dataAccess.readJson('receivables.json', tenantId);
        const rIdx = receivables.findIndex(r => r.code === order.companyCode);
        if (rIdx === -1) return;

        const transactions = receivables[rIdx].transactions || [];
        const originalCount = transactions.length;
        
        // Bu siparişe ait işlemi bul
        const targetTr = transactions.find(t => t.relatedId === order.id);
        if (!targetTr) return;

        // İşlemi sil
        const filteredTransactions = transactions.filter(t => t.relatedId !== order.id);
        
        const removedAmount = parseFloat(targetTr.amount) || 0;
        receivables[rIdx].transactions = filteredTransactions;
        receivables[rIdx].balance = (parseFloat(receivables[rIdx].balance) || 0) - removedAmount;
        receivables[rIdx].updatedAt = new Date().toISOString();
        
        await dataAccess.writeJson('receivables.json', receivables, tenantId);
        console.log(`Cari borç geri alındı: ${order.id}, Tutar: ${removedAmount}`);
    } catch (e) {
        console.error('removeCariDebt error:', e);
    }
}

module.exports = router;
