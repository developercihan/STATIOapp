const express = require('express');
const router = express.Router();
const path = require('path');
const prisma = require('../services/db.service');
const { requireLogin, requirePermission, requireRole, hasPermission } = require('../middlewares/auth.middleware');
const { makeId } = require('../utils/helpers');
const pdfService = require('../services/pdf.service');
const xmlService = require('../services/xml.service');
const fs = require('fs');
const crypto = require('crypto');

// GET /api/products
router.get('/products', requireLogin, async (req, res) => {
    try {
        const { search } = req.query;
        let where = { tenantId: req.user.tenantId };

        if (search) {
            const s = search.toLowerCase();
            where.OR = [
                { kod: { contains: s } },
                { ad: { contains: s } }
            ];
        }

        const products = await prisma.product.findMany({ where });
        res.json(products);
    } catch (e) { 
        console.error('Products fetch error:', e);
        res.status(500).json({ error: 'Ürünler okunamadı' }); 
    }
});

// GET /api/distributors
router.get('/distributors', requireLogin, async (req, res) => {
    try {
        // Distribütörler aslında User tablosunda rolü 'distributor' olanlar
        const dists = await prisma.user.findMany({
            where: {
                tenantId: req.user.tenantId,
                role: 'distributor',
                isActive: true
            },
            select: {
                id: true,
                username: true,
                displayName: true,
                phone: true,
                email: true
            }
        });
        const mapped = dists.map(d => ({
            kod: d.username,
            ad: d.displayName,
            phone: d.phone,
            email: d.email
        }));
        res.json(mapped);
    } catch (e) { 
        console.error('Distributors fetch error:', e);
        res.status(500).json({ error: 'Distribütörler okunamadı' }); 
    }
});

// GET /api/companies
router.get('/companies', requireLogin, async (req, res) => {
    try {
        const comps = await prisma.company.findMany({
            where: { tenantId: req.user.tenantId }
        });
        const receivables = await prisma.receivable.findMany({
            where: { tenantId: req.user.tenantId },
            select: { code: true, riskLimit: true }
        });

        const enriched = comps.map(c => {
            const rcv = receivables.find(r => r.code === c.cariKod);
            return { ...c, riskLimit: rcv ? rcv.riskLimit : 0 };
        });
        res.json(enriched);
    } catch (e) { 
        console.error('Companies fetch error:', e);
        res.status(500).json({ error: 'Kurumlar okunamadı' }); 
    }
});

// --- BÖLÜM 5: DEPO VE EVRAK (İRSALİYE/FATURA) MODÜLÜ ---

// GET /api/orders
router.get('/orders', requireLogin, async (req, res) => {
    try {
        let where = { tenantId: req.user.tenantId };

        // YETKİ KONTROLÜ
        if (req.user.role === 'distributor') {
            where.OR = [
                { createdBy: req.user.id },
                { distributorCode: req.user.username }
            ];
        } else if (req.user.role === 'warehouse') {
            if (req.user.warehouseId) {
                where.warehouseId = req.user.warehouseId;
            } else {
                return res.json([]);
            }
        }

        if (req.query.status) where.status = req.query.status;
        if (req.query.distributorCode) where.distributorCode = req.query.distributorCode;
        if (req.query.companyCode) where.companyCode = req.query.companyCode;

        const orders = await prisma.order.findMany({
            where,
            include: {
                items: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.json(orders);
    } catch (e) {
        console.error('Orders fetch error:', e);
        res.status(500).json({ error: 'Siparişler okunamadı' });
    }
});

// POST /api/orders
router.post('/orders', requireLogin, async (req, res) => {
    const t0 = Date.now();
    try {
        const { distributorCode, companyCode, items, orderType, notes } = req.body;
        const year = new Date().getFullYear();

        // Step 1: Lookups
        const [lastOrders, rcv, comp] = await Promise.all([
            prisma.order.findMany({
                where: { id: { startsWith: `ORD-${year}-` }, tenantId: req.user.tenantId },
                orderBy: { id: 'desc' },
                take: 1
            }),
            prisma.receivable.findFirst({ where: { code: companyCode, tenantId: req.user.tenantId } }),
            prisma.company.findFirst({ where: { cariKod: companyCode, tenantId: req.user.tenantId } })
        ]);
        const t1 = Date.now();
        console.log(`⏱️ Step 1 (Lookups): ${t1 - t0}ms`);

        const lastOrder = lastOrders[0];
        let nextNum = 1;
        if (lastOrder) {
            const match = lastOrder.id.match(new RegExp(`${year}-(\\d+)`));
            if (match) nextNum = parseInt(match[1]) + 1;
        }
        const newOrderId = `ORD-${year}-${String(nextNum).padStart(4, '0')}`;

        // Step 2: Calculations
        let totalAmount = 0; let totalTax = 0; let finalAmount = 0;
        const processedItems = items.map(item => {
            const pExcl = parseFloat(item.priceExclTax) || 0;
            const q = parseInt(item.miktar || item.qty) || 0;
            const tRate = parseFloat(item.taxRate) || 0;
            const dRate = parseFloat(item.discountRate) || 0;
            const lineExcl = pExcl * q * (1 - (dRate / 100));
            const lineTax = lineExcl * (tRate / 100);
            const lineTotal = lineExcl + lineTax;
            totalAmount += lineExcl; totalTax += lineTax; finalAmount += lineTotal;
            return {
                code: item.code || item.kod, name: item.name || item.ad,
                priceExclTax: pExcl, qty: q, taxRate: tRate, discountRate: dRate,
                lineTotalExcl: lineExcl, lineTax: lineTax, lineTotal: lineTotal
            };
        });
        const t2 = Date.now();
        console.log(`⏱️ Step 2 (Calculations): ${t2 - t1}ms`);

        // Step 3: Risk Check
        const riskLimit = parseFloat(comp ? comp.riskLimit : (rcv ? rcv.riskLimit : 0)) || 0;
        if (riskLimit > 0) {
            const currentBalance = parseFloat(rcv ? rcv.balance : 0) || 0;
            if (currentBalance + finalAmount > riskLimit) {
                return res.status(400).json({ error: `RİSK LİMİTİ AŞILDI!` });
            }
        }
        const t3 = Date.now();
        console.log(`⏱️ Step 3 (Risk Check): ${t3 - t2}ms`);

        // Step 4: Transaction (Write to Ireland)
        const result = await prisma.$transaction(async (tx) => {
            return await tx.order.create({
                data: {
                    id: newOrderId, distributorCode, companyCode,
                    orderType: orderType || 'SIPARIS', status: 'YENI',
                    totalAmount, totalTax, finalAmount, notes: notes || '',
                    publicToken: require('crypto').randomBytes(16).toString('hex'),
                    tenantId: req.user.tenantId, createdBy: req.user.id,
                    items: { create: processedItems }
                }
            });
        });
        const t4 = Date.now();
        console.log(`⏱️ Step 4 (DB Transaction): ${t4 - t3}ms`);

        // Step 5: Background Audit
        prisma.auditLog.create({
            data: {
                userId: req.user.id, username: req.user.username, role: req.user.role,
                action: 'ORDER_CREATED', entityType: 'order', entityId: newOrderId,
                tenantId: req.user.tenantId, details: JSON.stringify({ itemCount: items.length })
            }
        }).catch(err => console.error('Audit Log Error:', err));

        console.log(`🚀 Toplam Süre: ${Date.now() - t0}ms`);
        res.json({ message: 'Sipariş oluşturuldu', orderId: result.id });
    } catch (e) {
        console.error('Order creation error:', e);
        res.status(500).json({ error: 'Sipariş oluşturulamadı' });
    }
});

// GET /api/orders/:id
router.get('/orders/:id', requireLogin, async (req, res) => {
    try {
        const order = await prisma.order.findUnique({
            where: { id: req.params.id, tenantId: req.user.tenantId },
            include: { items: true }
        });
        
        if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı' });

        // YETKİ KONTROLÜ
        if (req.user.role === 'distributor' && order.createdBy !== req.user.id && order.distributorCode !== req.user.username) {
            return res.status(403).json({ error: 'Bu siparişi görme yetkiniz yok' });
        }
        if (req.user.role === 'warehouse' && order.warehouseId !== req.user.warehouseId) {
            return res.status(403).json({ error: 'Bu sipariş size atanmamış' });
        }

        // Eğer token yoksa (eski sipariş), üret ve kaydet (opsiyonel ama iyi olur)
        if (!order.publicToken) {
            const updated = await prisma.order.update({
                where: { id: req.params.id },
                data: { publicToken: crypto.randomBytes(16).toString('hex') },
                include: { items: true }
            });
            return res.json(updated);
        }

        res.json(order);
    } catch (e) {
        res.status(500).json({ error: 'Sipariş detayları alınamadı' });
    }
});

// DELETE /api/orders/:id
router.delete('/orders/:id', requireLogin, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Bu işlem için yönetici yetkisi gereklidir.' });

        await prisma.order.delete({
            where: { id: req.params.id, tenantId: req.user.tenantId }
        });

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
        
        await prisma.order.deleteMany({
            where: {
                id: { in: ids },
                tenantId: req.user.tenantId
            }
        });

        res.json({ message: 'Seçili siparişler silindi' });
    } catch (e) { 
        console.error('Bulk delete error:', e);
        res.status(500).json({ error: 'Toplu silme hatası: ' + e.message }); 
    }
});

// PUT /api/orders/:id
router.put('/orders/:id', requireLogin, requirePermission('orders.edit'), async (req, res) => {
    try {
        const order = await prisma.order.findUnique({
            where: { id: req.params.id, tenantId: req.user.tenantId },
            include: { items: true }
        });
        
        if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı' });

        const updates = req.body;
        const validStatuses = ['YENI', 'ATANDI', 'HAZIRLANIYOR', 'KARGODA', 'TESLIM_EDILDI', 'IPTAL_EDILDI'];
        if (updates.status && !validStatuses.includes(updates.status)) {
            return res.status(400).json({ error: 'Geçersiz durum' });
        }

        const oldStatus = order.status;
        const newStatus = updates.status || oldStatus;

        // Start transaction for status change and side effects
        const updatedOrder = await prisma.$transaction(async (tx) => {
            // Stock management logic
            if (newStatus === 'IPTAL_EDILDI' && oldStatus !== 'IPTAL_EDILDI' && oldStatus !== 'YENI' && oldStatus !== 'ATANDI') {
                await adjustStockTx(tx, order.items, 1, req.user.tenantId);
            } else if ((newStatus === 'HAZIRLANIYOR' || newStatus === 'KARGODA') && (oldStatus === 'YENI' || oldStatus === 'ATANDI')) {
                await adjustStockTx(tx, order.items, -1, req.user.tenantId);
            }

            // Update order status/data
            const up = await tx.order.update({
                where: { id: req.params.id },
                data: {
                    status: updates.status,
                    notes: updates.notes,
                    warehouseId: updates.warehouseId,
                    cargoDetail: updates.cargoDetail ? JSON.stringify(updates.cargoDetail) : undefined,
                    updatedAt: new Date()
                },
                include: { items: true }
            });

            // Teslim edildi ise cariye işle
            if (newStatus === 'TESLIM_EDILDI' && oldStatus !== 'TESLIM_EDILDI') {
                await addCariDebtTx(tx, up, req.user.tenantId);
            } else if (oldStatus === 'TESLIM_EDILDI' && newStatus !== 'TESLIM_EDILDI') {
                await removeCariDebtTx(tx, up, req.user.tenantId);
            }

            await tx.auditLog.create({
                data: {
                    userId: req.user.id,
                    username: req.user.username,
                    role: req.user.role,
                    action: 'ORDER_UPDATED',
                    entityType: 'order',
                    entityId: order.id,
                    tenantId: req.user.tenantId,
                    details: JSON.stringify({ oldStatus, newStatus })
                }
            });

            return up;
        });

        res.json({ message: 'Sipariş güncellendi', order: updatedOrder });
    } catch (e) {
        console.error('Order update error:', e);
        res.status(500).json({ error: 'Sipariş güncellenemedi' });
    }
});

// GET /api/orders/:id/pdf
router.get('/orders/:id/pdf', requireLogin, async (req, res) => {
    try {
        const order = await prisma.order.findUnique({
            where: { id: req.params.id, tenantId: req.user.tenantId },
            include: { items: true }
        });
        
        if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Siparis_${order.id}.pdf`);

        await pdfService.generateOrderPdf(order, res, req.user.tenantId);
    } catch (e) {
        console.error('PDF Error:', e);
        res.status(500).send('PDF oluşturulamadı');
    }
});

// GET /api/orders/:id/print
router.get('/orders/:id/print', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'preview.html'));
});

// GET /api/orders/:id/timeline
router.get('/orders/:id/timeline', requireLogin, async (req, res) => {
    try {
        const logs = await prisma.auditLog.findMany({
            where: {
                entityId: req.params.id,
                tenantId: req.user.tenantId
            },
            orderBy: { ts: 'desc' }
        });
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: 'Timeline alınamadı' });
    }
});

// POST /api/orders/:id/assign
router.post('/orders/:id/assign', requireLogin, requirePermission('orders.assign'), async (req, res) => {
    try {
        const { warehouseId } = req.body;
        
        await prisma.$transaction([
            prisma.order.update({
                where: { id: req.params.id, tenantId: req.user.tenantId },
                data: {
                    warehouseId,
                    status: 'ATANDI',
                    updatedAt: new Date()
                }
            }),
            prisma.auditLog.create({
                data: {
                    userId: req.user.id,
                    username: req.user.username,
                    role: req.user.role,
                    action: 'ORDER_ASSIGNED',
                    entityType: 'order',
                    entityId: req.params.id,
                    tenantId: req.user.tenantId,
                    details: JSON.stringify({ warehouseId })
                }
            })
        ]);

        res.json({ message: 'Depoya atandı' });
    } catch (e) {
        console.error('Assign error:', e);
        res.status(500).json({ error: 'Atama hatası' });
    }
});

// POST /api/orders/assign-bulk
router.post('/orders/assign-bulk', requireLogin, requirePermission('orders.assign'), async (req, res) => {
    try {
        const { orderIds, warehouseId } = req.body;
        if (!Array.isArray(orderIds)) return res.status(400).json({ error: 'orderIds dizisi hatalı' });

        const result = await prisma.order.updateMany({
            where: {
                id: { in: orderIds },
                tenantId: req.user.tenantId
            },
            data: {
                warehouseId,
                status: 'ATANDI',
                updatedAt: new Date()
            }
        });

        res.json({ message: `${result.count} sipariş atandı` });
    } catch (e) {
        console.error('Bulk assign error:', e);
        res.status(500).json({ error: 'Toplu atama hatası' });
    }
});

// PUT /api/orders/:id/warehouse-status
router.put('/orders/:id/warehouse-status', requireLogin, async (req, res) => {
    try {
        const { status, cargoDetail } = req.body;
        const validStatuses = ['HAZIRLANIYOR', 'KARGODA', 'TESLIM_EDILDI'];
        if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Geçersiz depo durumu' });

        const order = await prisma.order.findUnique({
            where: { id: req.params.id, tenantId: req.user.tenantId },
            include: { items: true }
        });
        
        if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı' });

        // Yetki kontrolü: Sadece ilgili depo veya admin
        if (req.user.role !== 'admin' && order.warehouseId !== req.user.warehouseId) {
            return res.status(403).json({ error: 'Bu sipariş size atanmamış' });
        }

        const oldStatus = order.status;

        const updated = await prisma.$transaction(async (tx) => {
            // Stock deduction logic
            if ((status === 'HAZIRLANIYOR' || status === 'KARGODA') && (oldStatus === 'YENI' || oldStatus === 'ATANDI')) {
                await adjustStockTx(tx, order.items, -1, req.user.tenantId);
            }

            const up = await tx.order.update({
                where: { id: req.params.id },
                data: {
                    status: status,
                    cargoDetail: cargoDetail ? JSON.stringify(cargoDetail) : undefined,
                    updatedAt: new Date()
                },
                include: { items: true }
            });

            // Teslim edildi ise cariye işle
            if (status === 'TESLIM_EDILDI' && oldStatus !== 'TESLIM_EDILDI') {
                await addCariDebtTx(tx, up, req.user.tenantId);
            } else if (oldStatus === 'TESLIM_EDILDI' && status !== 'TESLIM_EDILDI') {
                await removeCariDebtTx(tx, up, req.user.tenantId);
            }

            await tx.auditLog.create({
                data: {
                    userId: req.user.id,
                    username: req.user.username,
                    role: req.user.role,
                    action: 'ORDER_STATUS_CHANGED',
                    entityType: 'order',
                    entityId: req.params.id,
                    tenantId: req.user.tenantId,
                    details: JSON.stringify({ status, cargoDetail })
                }
            });

            return up;
        });

        res.json({ message: 'Durum güncellendi' });
    } catch (e) { 
        console.error('Warehouse status update error:', e);
        res.status(500).json({ error: 'Durum güncellenemedi' }); 
    }
});

// GET /api/orders/export.csv
router.get('/orders/export.csv', requireRole('admin'), async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            where: { tenantId: req.user.tenantId },
            orderBy: { createdAt: 'desc' }
        });
        
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
        const warehouses = await prisma.warehouse.findMany({
            where: { tenantId: req.user.tenantId }
        });
        if (req.user.role === 'admin') return res.json(warehouses);
        res.json(warehouses.filter(w => w.isActive));
    } catch (e) { res.status(500).json({ error: 'Depolar okunamadı' }); }
});

// POST /api/warehouses
router.post('/warehouses', requireLogin, requirePermission('warehouses.manage'), async (req, res) => {
    try {
        const { name, responsible } = req.body;
        if (!name) return res.status(400).json({ error: 'Depo adı zorunludur' });
        
        const newWarehouse = await prisma.warehouse.create({
            data: {
                name,
                responsible: responsible || '',
                isActive: true,
                tenantId: req.user.tenantId
            }
        });
        res.json({ message: 'Depo eklendi', warehouse: newWarehouse });
    } catch (e) { res.status(500).json({ error: 'Depo eklenemedi' }); }
});

// PUT /api/warehouses/:id
router.put('/warehouses/:id', requireLogin, requirePermission('warehouses.manage'), async (req, res) => {
    try {
        const { name, responsible, isActive } = req.body;
        await prisma.warehouse.update({
            where: { id: req.params.id, tenantId: req.user.tenantId },
            data: {
                name,
                responsible,
                isActive
            }
        });
        res.json({ message: 'Depo güncellendi' });
    } catch (e) { res.status(500).json({ error: 'Depo güncellenemedi' }); }
});

// DELETE /api/warehouses/:id
router.delete('/warehouses/:id', requireLogin, requirePermission('warehouses.manage'), async (req, res) => {
    try {
        await prisma.warehouse.delete({
            where: { id: req.params.id, tenantId: req.user.tenantId }
        });
        res.json({ message: 'Depo silindi' });
    } catch (e) { res.status(500).json({ error: 'Depo silinemedi' }); }
});

// --- STOK VE CARİ FONKSİYONLARI (PRISMA TRANSACTION UYUMLU) ---

async function adjustStockTx(tx, items, multiplier, tenantId) {
    for (const item of items) {
        const code = item.code || item.kod;
        const qty = parseInt(item.qty || item.miktar) || 0;
        
        await tx.product.update({
            where: { kod_tenantId: { kod: code, tenantId } },
            data: {
                stock: { increment: qty * multiplier }
            }
        });
    }
}

async function addCariDebtTx(tx, order, tenantId) {
    // Cariyi bul veya oluştur
    let receivable = await tx.receivable.findUnique({
        where: { code_tenantId: { code: order.companyCode, tenantId } }
    });

    if (!receivable) {
        const compInfo = await tx.company.findUnique({
            where: { cariKod_tenantId: { cariKod: order.companyCode, tenantId } }
        });
        
        receivable = await tx.receivable.create({
            data: {
                code: order.companyCode,
                companyName: compInfo ? compInfo.ad : order.companyCode,
                balance: 0,
                riskLimit: compInfo ? (compInfo.riskLimit || 0) : 0,
                status: 'BORCLU',
                source: 'auto-delivered',
                tenantId: tenantId
            }
        });
    }

    // MÜKERRER KONTROLÜ: Eğer bu sipariş için zaten bir ekstre kaydı varsa (fatura kesilmiş olabilir) ekleme.
    const existing = await tx.transaction.findFirst({
        where: { receivableId: receivable.id, relatedId: order.id }
    });
    if (existing) {
        console.log(`[DATA] Debt already exists for order ${order.id}, skipping.`);
        return;
    }

    const amount = parseFloat(order.finalAmount) || 0;
    const newBalance = (parseFloat(receivable.balance) || 0) + amount;

    await tx.transaction.create({
        data: {
            receivableId: receivable.id,
            description: `Sipariş Teslim Edildi (#${order.id})`,
            relatedId: order.id,
            amount: amount,
            type: 'INVOICE',
            balanceAfter: newBalance
        }
    });

    await tx.receivable.update({
        where: { id: receivable.id },
        data: { 
            balance: newBalance,
            status: 'BORCLU'
        }
    });
}

async function removeCariDebtTx(tx, order, tenantId) {
    const receivable = await tx.receivable.findUnique({
        where: { code_tenantId: { code: order.companyCode, tenantId } }
    });
    if (!receivable) return;

    const targetTr = await tx.transaction.findFirst({
        where: { receivableId: receivable.id, relatedId: order.id }
    });
    if (!targetTr) return;

    const removedAmount = parseFloat(targetTr.amount) || 0;
    
    await tx.transaction.delete({ where: { id: targetTr.id } });
    
    await tx.receivable.update({
        where: { id: receivable.id },
        data: { 
            balance: { decrement: removedAmount }
        }
    });
}

module.exports = router;
