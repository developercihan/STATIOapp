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
        const productsPath = path.join(dataAccess.dataDir, 'products.json');
        let products = await dataAccess.readJson(productsPath);
        
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
        const distsPath = path.join(dataAccess.dataDir, 'distributors.json');
        const dists = await dataAccess.readJson(distsPath);
        res.json(dists);
    } catch (e) { res.status(500).json({ error: 'Distribütörler okunamadı' }); }
});

// GET /api/companies
router.get('/companies', requireLogin, async (req, res) => {
    try {
        const compPath = path.join(dataAccess.dataDir, 'companies.json');
        const comps = await dataAccess.readJson(compPath);
        res.json(comps);
    } catch (e) { res.status(500).json({ error: 'Kurumlar okunamadı' }); }
});

// --- BÖLÜM 5: DEPO VE EVRAK (İRSALİYE/FATURA) MODÜLÜ ---
const ordersPath = path.join(dataAccess.dataDir, 'orders.json');

// GET /api/orders
router.get('/orders', requireLogin, async (req, res) => {
    try {
        let orders = await dataAccess.readJson(ordersPath);
        
        // YETKİ KONTROLÜ: Distribütörler sadece kendi siparişlerini, depolar sadece kendilerine atanmış siparişleri görür.
        if (req.user.role === 'distributor') {
            orders = orders.filter(o => o.createdBy === req.user.id || o.distributorCode === req.user.username);
        } else if (req.user.role === 'warehouse') {
            if (req.user.warehouseId) {
                orders = orders.filter(o => o.warehouseId === req.user.warehouseId);
            } else {
                orders = []; // Atanmış depo yoksa hiçbir şey göremez
            }
        }
        // Admin her şeyi görür (yukarıdaki if bloklarına girmez)
        
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
        
        const orders = await dataAccess.readJson(ordersPath);
        
        // Yeni Numeratik ID Oluşturma (Örn: 2026-001)
        const year = new Date().getFullYear();
        let maxNum = 0;
        orders.forEach(o => {
            const match = o.id.match(new RegExp(`${year}-(\\d+)`));
            if (match && parseInt(match[1]) > maxNum) maxNum = parseInt(match[1]);
        });
        const newOrderId = `ORD-${year}-${String(maxNum + 1).padStart(4, '0')}`;
        
        // Calculate Totals using advanced logic
        let totalAmount = 0; // Excl. Tax
        let totalTax = 0;
        let finalAmount = 0; // Incl. Tax
        
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
            totalAmount: totalAmount, // KDV Hariç Toplam
            totalTax: totalTax,       // Toplam KDV
            finalAmount: finalAmount, // KDV Dahil Toplam
            notes: notes || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: req.user.id
        };
        
        orders.push(newOrder);
        await dataAccess.writeJson(ordersPath, orders);
        
        await dataAccess.appendAuditLog({
            ts: new Date().toISOString(),
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role,
            action: 'ORDER_CREATED',
            entityType: 'order',
            entityId: newOrder.id,
            details: { itemCount: items.length }
        });
        
        // Örnek bildirim entegrasyonu (nodemailer) eksik - ilerde services üzerinden aktarılır
        
        res.json({ message: 'Sipariş oluşturuldu', orderId: newOrder.id });
    } catch (e) {
        res.status(500).json({ error: 'Sipariş oluşturulamadı' });
    }
});

// GET /api/orders/:id
router.get('/orders/:id', requireLogin, async (req, res) => {
    const orders = await dataAccess.readJson(ordersPath);
    const order = orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı' });
    
    // YETKİ KONTROLÜ: Detay görme yetkisi kısıtlanıyor
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
        if(req.user.role !== 'admin') return res.status(403).json({ error: 'Bu işlem için yönetici yetkisi gereklidir.' });
        
        const orders = await dataAccess.readJson(ordersPath);
        const filtered = orders.filter(o => o.id !== req.params.id);
        
        await dataAccess.writeJson(ordersPath, filtered);
        res.json({ message: 'Sipariş başarıyla silindi' });
    } catch (e) {
        res.status(500).json({ error: 'Silme hatası: ' + e.message });
    }
});

// POST /api/orders/bulk-delete
router.post('/orders/bulk-delete', requireLogin, async (req, res) => {
    try {
        if(req.user.role !== 'admin') return res.status(403).json({ error: 'Yönetici yetkisi gereklidir.' });
        const { ids } = req.body;
        let orders = await dataAccess.readJson(ordersPath);
        orders = orders.filter(o => !ids.includes(o.id));
        await dataAccess.writeJson(ordersPath, orders);
        res.json({ message: 'Seçili siparişler silindi' });
    } catch (e) { res.status(500).json({ error: 'Toplu silme hatası: ' + e.message }); }
});

// PUT /api/orders/:id
router.put('/orders/:id', requireLogin, requirePermission('orders.edit'), async (req, res) => {
    try {
        const orders = await dataAccess.readJson(ordersPath);
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
            // Restore stock if it was already deducted
            await adjustStock(orders[index].items, 1); // multiply by 1 to add
        } else if ((newStatus === 'HAZIRLANIYOR' || newStatus === 'KARGODA') && (oldStatus === 'YENI' || oldStatus === 'ATANDI')) {
            // Deduct stock when starting preparation
            await adjustStock(orders[index].items, -1); // multiply by -1 to subtract
        }

        orders[index] = { ...orders[index], ...updates, updatedAt: new Date().toISOString() };
        await dataAccess.writeJson(ordersPath, orders);
        
        await dataAccess.appendAuditLog({
            ts: new Date().toISOString(),
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role,
            action: 'ORDER_UPDATED',
            entityType: 'order',
            entityId: orders[index].id,
            details: { updates }
        });
        
        res.json({ message: 'Sipariş güncellendi', order: orders[index] });
    } catch (e) {
        res.status(500).json({ error: 'Sipariş güncellenemedi' });
    }
});

// GET /api/orders/:id/pdf
router.get('/orders/:id/pdf', requireLogin, async (req, res) => {
    const orders = await dataAccess.readJson(ordersPath);
    const order = orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı' });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Siparis_${order.id}.pdf`);
    
    await pdfService.generateOrderPdf(order, res);
});

// GET /api/orders/:id/print
router.get('/orders/:id/print', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'preview.html'));
});

// GET /api/orders/:id/timeline
router.get('/orders/:id/timeline', requireLogin, async (req, res) => {
    const logsDir = path.join(dataAccess.dataDir, 'audit_logs.json');
    const logs = await dataAccess.readJson(logsDir);
    const orderLogs = logs.filter(l => l.entityId === req.params.id);
    res.json(orderLogs);
});

// POST /api/orders/:id/assign
router.post('/orders/:id/assign', requireLogin, requirePermission('orders.assign'), async (req, res) => {
    try {
        const { warehouseId } = req.body;
        const orders = await dataAccess.readJson(ordersPath);
        const index = orders.findIndex(o => o.id === req.params.id);
        if (index === -1) return res.status(404).json({ error: 'Sipariş bulunamadı' });
        
        orders[index].warehouseId = warehouseId;
        orders[index].status = 'ATANDI';
        orders[index].updatedAt = new Date().toISOString();
        
        await dataAccess.writeJson(ordersPath, orders);
        
        await dataAccess.appendAuditLog({
            ts: new Date().toISOString(),
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role,
            action: 'ORDER_ASSIGNED',
            entityType: 'order',
            entityId: orders[index].id,
            details: { warehouseId }
        });
        
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
        
        const orders = await dataAccess.readJson(ordersPath);
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
        
        await dataAccess.writeJson(ordersPath, orders);
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
        
        const orders = await dataAccess.readJson(ordersPath);
        const index = orders.findIndex(o => o.id === req.params.id);
        if (index === -1) return res.status(404).json({ error: 'Sipariş bulunamadı' });
        
        // Yetki kontrolü: Sadece ilgili depo veya admin
        if (req.user.role !== 'admin' && orders[index].warehouseId !== req.user.warehouseId) {
            return res.status(403).json({ error: 'Bu sipariş size atanmamış' });
        }
        
        const oldStatus = orders[index].status;
        
        // Stock deduction logic for warehouse status updates
        if ((status === 'HAZIRLANIYOR' || status === 'KARGODA') && (oldStatus === 'YENI' || oldStatus === 'ATANDI')) {
            await adjustStock(orders[index].items, -1);
        }

        orders[index].status = status;
        if (status === 'KARGODA' && cargoDetail) {
            orders[index].cargoDetail = cargoDetail; // { company, trackingCode }
        }
        orders[index].updatedAt = new Date().toISOString();
        await dataAccess.writeJson(ordersPath, orders);
        
        await dataAccess.appendAuditLog({
            ts: new Date().toISOString(),
            userId: req.user.id,
            username: req.user.username,
            role: req.user.role,
            action: 'ORDER_STATUS_CHANGED',
            entityType: 'order',
            entityId: req.params.id,
            details: { status, cargoDetail }
        });

        res.json({ message: 'Durum güncellendi' });
    } catch (e) { res.status(500).json({ error: 'Durum güncellenemedi' }); }
});

// GET /api/orders/export.csv
router.get('/orders/export.csv', requireRole('admin'), async (req, res) => {
    try {
        const orders = await dataAccess.readJson(ordersPath);
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
const warehousesPath = path.join(dataAccess.dataDir, 'warehouses.json');
const deliveryNotesPath = path.join(dataAccess.dataDir, 'delivery_notes.json');
const invoicesPath = path.join(dataAccess.dataDir, 'invoices.json');

// GET /api/warehouses
router.get('/warehouses', requireLogin, async (req, res) => {
    try {
        const warehouses = await dataAccess.readJson(warehousesPath);
        // Admin her şeyi görür, diğerleri sadece aktifleri
        if(req.user.role === 'admin') return res.json(warehouses);
        res.json(warehouses.filter(w => w.isActive));
    } catch (e) { res.status(500).json({ error: 'Depolar okunamadı' }); }
});

// POST /api/warehouses
router.post('/warehouses', requireLogin, requirePermission('warehouses.manage'), async (req, res) => {
    try {
        const { id, name, responsible } = req.body;
        if (!name) return res.status(400).json({ error: 'Depo adı zorunludur' });
        const warehouses = await dataAccess.readJson(warehousesPath);
        const newWarehouse = {
            id: id || makeId('wh'),
            name,
            responsible: responsible || '',
            isActive: true,
            createdAt: new Date().toISOString()
        };
        warehouses.push(newWarehouse);
        await dataAccess.writeJson(warehousesPath, warehouses);
        res.json({ message: 'Depo eklendi', warehouse: newWarehouse });
    } catch (e) { res.status(500).json({ error: 'Depo eklenemedi' }); }
});

// PUT /api/warehouses/:id
router.put('/warehouses/:id', requireLogin, requirePermission('warehouses.manage'), async (req, res) => {
    try {
        const { name, responsible, isActive } = req.body;
        const warehouses = await dataAccess.readJson(warehousesPath);
        const index = warehouses.findIndex(w => w.id === req.params.id);
        if (index === -1) return res.status(404).json({ error: 'Depo bulunamadı' });
        if (name) warehouses[index].name = name;
        if (responsible !== undefined) warehouses[index].responsible = responsible;
        if (isActive !== undefined) warehouses[index].isActive = isActive;
        await dataAccess.writeJson(warehousesPath, warehouses);
        res.json({ message: 'Depo güncellendi' });
    } catch (e) { res.status(500).json({ error: 'Depo güncellenemedi' }); }
});

// DELETE /api/warehouses/:id
router.delete('/warehouses/:id', requireLogin, requirePermission('warehouses.manage'), async (req, res) => {
    try {
        const warehouses = await dataAccess.readJson(warehousesPath);
        const index = warehouses.findIndex(w => w.id === req.params.id);
        if (index === -1) return res.status(404).json({ error: 'Depo bulunamadı' });
        warehouses.splice(index, 1);
        await dataAccess.writeJson(warehousesPath, warehouses);
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
        const notes = await dataAccess.readJson(deliveryNotesPath);
        res.json(notes);
    } catch (e) {
        res.status(500).json({ error: 'İrsaliyeler okunamadı' });
    }
});

// GET /api/admin/invoices
router.get('/admin/invoices', requireLogin, requirePermission('orders.create_invoice'), async (req, res) => {
    try {
        const invoices = await dataAccess.readJson(invoicesPath);
        res.json(invoices);
    } catch (e) {
        res.status(500).json({ error: 'Faturalar okunamadı' });
    }
});
router.post('/admin/stock-adjust', requireLogin, requireRole('admin'), async (req, res) => {
    try {
        const { code, amount, type } = req.body; // type: 'add' or 'set'
        const productsPath = path.join(dataAccess.dataDir, 'products.json');
        const products = await dataAccess.readJson(productsPath);
        const pIdx = products.findIndex(p => p.kod === code);
        if (pIdx === -1) return res.status(404).json({ error: 'Ürün bulunamadı' });
        
        if (type === 'set') {
            products[pIdx].stock = parseInt(amount);
        } else {
            products[pIdx].stock = (products[pIdx].stock || 0) + parseInt(amount);
        }
        
        await dataAccess.writeJson(productsPath, products);
        res.json({ message: 'Stok güncellendi', newStock: products[pIdx].stock });
    } catch (e) { res.status(500).json({ error: 'Stok güncellenemedi' }); }
});

async function adjustStock(items, multiplier) {
    try {
        const productsPath = path.join(dataAccess.dataDir, 'products.json');
        const products = await dataAccess.readJson(productsPath);
        
        items.forEach(item => {
            const pIdx = products.findIndex(p => p.kod === item.code);
            if (pIdx !== -1) {
                const qty = parseInt(item.qty) || parseInt(item.miktar) || 0;
                products[pIdx].stock = (products[pIdx].stock || 0) + (qty * multiplier);
            }
        });
        
        await dataAccess.writeJson(productsPath, products);
    } catch (e) {
        console.error('Stock adjustment error:', e);
    }
}

module.exports = router;
