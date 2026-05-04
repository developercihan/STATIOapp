const express = require('express');
const router = express.Router();
const prisma = require('../services/db.service');
const { requireLogin, csrfCheck, requirePermission } = require('../middlewares/auth.middleware');
const EFaturaService = require('../services/efatura.service');

// GET /api/invoices - Fatura Listesini Getir
router.get('/invoices', requireLogin, requirePermission('invoice.view'), async (req, res) => {
    try {
        const invoices = await prisma.invoice.findMany({
            where: { tenantId: req.user.tenantId },
            orderBy: { date: 'desc' }
        });

        // Cari adlarını ekleyelim
        const companies = await prisma.company.findMany({
            where: { tenantId: req.user.tenantId }
        });
        const companyMap = {};
        companies.forEach(c => companyMap[c.cariKod] = c.ad);

        const mapped = invoices.map(inv => ({
            ...inv,
            companyName: companyMap[inv.companyId] || inv.companyId
        }));

        res.json(mapped);
    } catch (e) {
        console.error('Invoices fetch error:', e);
        res.status(500).json({ error: 'Faturalar okunamadı' });
    }
});

// GET /api/invoices/:id - Tekil Fatura Getir
router.get('/invoices/:id', requireLogin, requirePermission('invoice.view'), async (req, res) => {
    try {
        const invoice = await prisma.invoice.findFirst({
            where: { 
                OR: [
                    { id: req.params.id },
                    { uuid: req.params.id }
                ],
                tenantId: req.user.tenantId 
            }
        });

        if (!invoice) return res.status(404).json({ error: 'Belge bulunamadı' });

        const company = await prisma.company.findFirst({
            where: { cariKod: invoice.companyId, tenantId: req.user.tenantId }
        });

        res.json({ ...invoice, companyName: company ? company.ad : invoice.companyId });
    } catch (e) {
        res.status(500).json({ error: 'Belge detayları alınamadı' });
    }
});

// POST /api/invoices/create-from-order - Siparişi Faturaya Çevir (e-Fatura Kes)
router.post('/invoices/create-from-order', requireLogin, requirePermission('invoice.create'), csrfCheck, async (req, res) => {
    try {
        const { orderId } = req.body;
        
        // 1. Siparişi ve Firmayı Bul
        const order = await prisma.order.findFirst({
            where: { id: orderId, tenantId: req.user.tenantId },
            include: { items: true }
        });
        if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı' });
        if (order.status === 'CANCELLED') return res.status(400).json({ error: 'İptal edilmiş siparişe fatura kesilemez' });

        const company = await prisma.company.findFirst({
            where: { cariKod: order.companyCode, tenantId: req.user.tenantId }
        });
        if (!company) return res.status(400).json({ error: 'Cari/Firma kaydı bulunamadı' });

        // e-Fatura zorunlu alan kontrolü
        if (!company.taxNumber || !company.taxOffice || !company.province) {
            return res.status(400).json({ 
                error: 'Cari kartta e-Fatura eksikleri var!', 
                details: 'Lütfen firmanın Vergi No, Vergi Dairesi ve İl bilgilerini doldurun.' 
            });
        }

        // Fatura daha önce kesilmiş mi kontrolü
        const existingInvoice = await prisma.invoice.findFirst({
            where: { orderId: order.id, tenantId: req.user.tenantId, status: { not: 'CANCELLED' } }
        });
        if (existingInvoice) {
            return res.status(400).json({ error: 'Bu siparişe zaten bir fatura kesilmiş.' });
        }

        // 2. Mükellef Sorgulama ve e-Fatura/e-Arşiv Tipi Belirleme
        const taxInfo = await EFaturaService.checkTaxPayer(company.taxNumber);

        // 3. Entegratöre Gönderim Verisini Hazırla
        const invoiceData = {
            orderId: order.id,
            company: company,
            totalAmount: order.totalAmount,
            taxAmount: order.totalTax,
            finalAmount: order.finalAmount,
            type: taxInfo.type, // E-FATURA veya E-ARSIV
            items: order.items || []
        };

        const tenantSettings = {}; // İleride prisma.tenant üzerinden çekilecek

        // 4. Uyumsoft (Entegratör) Servisine Gönder
        const response = await EFaturaService.createEInvoice(tenantSettings, invoiceData);

        if (!response.success) {
            return res.status(500).json({ error: 'Entegratör Hatası: ' + response.message });
        }

        // 5. Başarılı ise Veritabanına Fatura Olarak Kaydet (İşlemle Birlikte)
        const result = await prisma.$transaction(async (tx) => {
            const newInvoice = await tx.invoice.create({
                data: {
                    invoiceNo: response.invoiceNo,
                    uuid: response.uuid,
                    type: 'SALES',
                    docType: 'INVOICE',
                    companyId: company.cariKod,
                    orderId: order.id,
                    totalAmount: order.finalAmount,
                    taxAmount: order.totalTax,
                    status: response.status || 'ISSUED',
                    details: JSON.stringify(Array.isArray(order.items) ? order.items.map(i => ({
                        code: i.code || i.kod || '',
                        kod: i.kod || i.code || '',
                        name: i.name || i.ad || i.description || '',
                        ad: i.ad || i.name || '',
                        qty: i.qty || i.miktar || 1,
                        price: i.priceExclTax || i.price || 0,
                        taxRate: i.taxRate || 20,
                        discountRate: i.discountRate || 0,
                        lineTotal: i.lineTotal || 0
                    })) : []),
                    tenantId: req.user.tenantId
                }
            });

            // Cari Ekstresine İşle
            let rcv = await tx.receivable.findUnique({
                where: { code_tenantId: { code: company.cariKod, tenantId: req.user.tenantId } }
            });
            if (!rcv) {
                rcv = await tx.receivable.create({
                    data: {
                        code: company.cariKod,
                        companyName: company.ad,
                        balance: 0,
                        status: 'BORCLU',
                        source: 'auto-invoice',
                        tenantId: req.user.tenantId
                    }
                });
            }

            // Mükerrer kontrolü: Hem sipariş ID hem fatura ID ile bak
            const existingTr = await tx.transaction.findFirst({
                where: { 
                    receivableId: rcv.id, 
                    OR: [
                        { relatedId: order.id },
                        { relatedId: newInvoice.id }
                    ]
                }
            });

            if (!existingTr) {
                const amount = parseFloat(order.finalAmount) || 0;
                const newBalance = (parseFloat(rcv.balance) || 0) + amount;

                await tx.transaction.create({
                    data: {
                        receivableId: rcv.id,
                        description: `Fatura Kesildi (#${newInvoice.invoiceNo})`,
                        relatedId: order.id, // Sipariş ID'sini birincil takip anahtarı yapıyoruz
                        amount: amount,
                        type: 'INVOICE',
                        balanceAfter: newBalance
                    }
                });

                await tx.receivable.update({
                    where: { id: rcv.id },
                    data: { balance: newBalance, status: 'BORCLU' }
                });
                console.log(`[INVOICE] Debt added to ekstre: ${company.cariKod}, Amount: ${amount}`);
            }

            await tx.order.update({
                where: { id: order.id },
                data: { status: 'INVOICED' }
            });

            return newInvoice;
        });

        res.json({ message: 'e-Fatura başarıyla kesildi ve cariye işlendi.', invoice: result });

    } catch (e) {
        console.error('Invoice creation error:', e);
        res.status(500).json({ error: 'Fatura oluşturulurken kritik hata: ' + e.message });
    }
});

// POST /api/invoices/quick - Siparişsiz Hızlı Belge Oluştur (Toplu İşlem Destekli)
router.post('/invoices/quick', requireLogin, requirePermission('invoice.create'), csrfCheck, async (req, res) => {
    try {
        const { companyIds, docType, details, totalAmount, taxAmount, carrierInfo } = req.body;
        
        console.log(`[QUICK-BULK] Starting process for ${companyIds?.length} companies. Type: ${docType}`);

        if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
            return res.status(400).json({ error: 'En az bir cari seçilmelidir.' });
        }

        const items = JSON.parse(details);
        
        // Paralel işleme: Tüm cariler için istekleri aynı anda başlat
        const tasks = companyIds.map(async (companyId) => {
            try {
                const company = await prisma.company.findFirst({
                    where: { cariKod: companyId, tenantId: req.user.tenantId }
                });
                
                if (!company) {
                    console.warn(`[QUICK-BULK] Company not found: ${companyId}`);
                    return { success: false, error: 'Cari bulunamadı', companyId };
                }

                let response;
                const servicePayload = { 
                    company, 
                    items, 
                    totalAmount: parseFloat(totalAmount), 
                    taxAmount: parseFloat(taxAmount),
                    carrierInfo 
                };

                if (docType === 'INVOICE') {
                    response = await EFaturaService.createEInvoice({}, servicePayload);
                } else {
                    response = await EFaturaService.createDespatch({}, servicePayload);
                }

                if (response.success) {
                    const finalRes = await prisma.$transaction(async (tx) => {
                        const newDoc = await tx.invoice.create({
                            data: {
                                invoiceNo: response.invoiceNo || response.despatchNo,
                                uuid: response.uuid,
                                type: 'SALES',
                                docType: docType,
                                companyId: company.cariKod,
                                totalAmount: parseFloat(totalAmount),
                                taxAmount: parseFloat(taxAmount),
                                status: 'ISSUED',
                                details: JSON.stringify(items),
                                carrierInfo: carrierInfo ? JSON.stringify(carrierInfo) : null,
                                tenantId: req.user.tenantId,
                                date: new Date()
                            }
                        });

                        // Hızlı Belgeyi Cari Ekstresine İşle
                        let rcv = await tx.receivable.findUnique({
                            where: { code_tenantId: { code: company.cariKod, tenantId: req.user.tenantId } }
                        });
                        if (!rcv) {
                            rcv = await tx.receivable.create({
                                data: {
                                    code: company.cariKod,
                                    companyName: company.ad,
                                    balance: 0,
                                    status: 'BORCLU',
                                    source: 'auto-quick-invoice',
                                    tenantId: req.user.tenantId
                                }
                            });
                        }

                        const amount = parseFloat(totalAmount) || 0;
                        const newBalance = (parseFloat(rcv.balance) || 0) + amount;

                        await tx.transaction.create({
                            data: {
                                receivableId: rcv.id,
                                description: `${docType === 'DESPATCH' ? 'İrsaliye' : 'Fatura'} Kesildi (#${newDoc.invoiceNo})`,
                                relatedId: newDoc.id,
                                amount: amount,
                                type: 'INVOICE',
                                balanceAfter: newBalance
                            }
                        });

                        await tx.receivable.update({
                            where: { id: rcv.id },
                            data: { balance: newBalance, status: 'BORCLU' }
                        });
                        console.log(`[QUICK-INVOICE] Debt added to ekstre: ${company.cariKod}, Amount: ${amount}`);

                        return newDoc;
                    });

                    console.log(`[QUICK-BULK] Success: ${finalRes.invoiceNo} created for ${companyId}`);
                    return { success: true, invoiceNo: finalRes.invoiceNo };
                } else {
                    return { success: false, error: response.message || 'Servis hatası', companyId };
                }
            } catch (innerError) {
                console.error(`[QUICK-BULK] Error processing ${companyId}:`, innerError);
                return { success: false, error: innerError.message, companyId };
            }
        });

        const results = await Promise.all(tasks);
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        console.log(`[QUICK-BULK] Finished. Success: ${successful.length}, Failed: ${failed.length}`);

        if (successful.length === 0 && failed.length > 0) {
            return res.status(500).json({ 
                error: 'Belgeler oluşturulamadı.', 
                details: failed.map(f => `${f.companyId}: ${f.error}`).join(', ') 
            });
        }

        res.json({ 
            message: `${successful.length} adet belge başarıyla oluşturuldu.${failed.length > 0 ? ` (${failed.length} hata oluştu)` : ''}`, 
            invoiceNumbers: successful.map(s => s.invoiceNo),
            failedCount: failed.length
        });
    } catch (e) {
        console.error('Bulk quick invoice critical error:', e);
        res.status(500).json({ error: 'Kritik sistem hatası: ' + e.message });
    }
});

// POST /api/invoices/create-despatch - Siparişi İrsaliyeye Çevir (e-İrsaliye Kes)
router.post('/invoices/create-despatch', requireLogin, requirePermission('invoice.create'), csrfCheck, async (req, res) => {
    try {
        const { orderId, carrierInfo } = req.body;
        
        const order = await prisma.order.findFirst({
            where: { id: orderId, tenantId: req.user.tenantId },
            include: { items: true } // Kalemleri dahil et
        });
        if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı' });

        const company = await prisma.company.findFirst({
            where: { cariKod: order.companyCode, tenantId: req.user.tenantId }
        });
        if (!company) return res.status(400).json({ error: 'Cari/Firma kaydı bulunamadı' });

        // e-Fatura zorunlu alan kontrolü
        if (!company.taxNumber || !company.taxOffice || !company.province) {
            return res.status(400).json({ 
                error: 'Cari kartta e-İrsaliye eksikleri var!', 
                details: 'Lütfen firmanın Vergi No, Vergi Dairesi ve İl bilgilerini doldurun.' 
            });
        }

        const existingDespatch = await prisma.invoice.findFirst({
            where: { orderId: order.id, tenantId: req.user.tenantId, docType: 'DESPATCH', status: { not: 'CANCELLED' } }
        });
        if (existingDespatch) {
            return res.status(400).json({ error: 'Bu siparişe zaten bir irsaliye kesilmiş.' });
        }

        // Taşıyıcı bilgilerini servise gönder
        const response = await EFaturaService.createDespatch({}, { company, order, carrierInfo });

        if (!response.success) {
            return res.status(500).json({ error: 'Entegratör Hatası: ' + response.message });
        }

        const newDespatch = await prisma.invoice.create({
            data: {
                invoiceNo: response.despatchNo,
                uuid: response.uuid,
                type: 'SALES',
                docType: 'DESPATCH',
                companyId: company.cariKod,
                orderId: order.id,
                totalAmount: order.finalAmount,
                taxAmount: order.totalTax,
                status: 'ISSUED',
                details: JSON.stringify(Array.isArray(order.items) ? order.items.map(i => ({
                    code: i.code || i.kod || '',
                    kod: i.kod || i.code || '',
                    name: i.name || i.ad || i.description || '',
                    ad: i.ad || i.name || '',
                    qty: i.qty || i.miktar || 1,
                    price: i.priceExclTax || i.price || 0,
                    taxRate: i.taxRate || 20,
                    discountRate: i.discountRate || 0,
                    lineTotal: i.lineTotal || 0
                })) : []),
                carrierInfo: carrierInfo ? JSON.stringify(carrierInfo) : null,
                tenantId: req.user.tenantId
            }
        });

        res.json({ message: 'e-İrsaliye Başarıyla Oluşturuldu', despatch: newDespatch });
    } catch (e) {
        console.error('Despatch creation error:', e);
        res.status(500).json({ error: 'İrsaliye oluşturulurken kritik hata: ' + e.message });
    }
});

// PUT /api/invoices/:uuid - Belge Düzenle
router.put('/invoices/:uuid', requireLogin, requirePermission('invoice.edit'), csrfCheck, async (req, res) => {
    try {
        const { uuid } = req.params;
        const data = req.body;

        const invoice = await prisma.invoice.findFirst({
            where: { uuid, tenantId: req.user.tenantId }
        });

        if (!invoice) return res.status(404).json({ error: 'Belge bulunamadı' });
        
        // Alış faturaları her zaman düzenlenebilir (içeri almadan önce düzeltme yapmak için)
        if (invoice.type !== 'PURCHASE' && invoice.status === 'SENT') {
            return res.status(400).json({ error: 'Entegratöre gönderilmiş belgeler düzenlenemez.' });
        }

        const updated = await prisma.invoice.updateMany({
            where: { uuid, tenantId: req.user.tenantId },
            data: {
                totalAmount: parseFloat(data.totalAmount),
                taxAmount: parseFloat(data.taxAmount),
                details: data.details,
                carrierInfo: data.carrierInfo ? JSON.stringify(data.carrierInfo) : null
            }
        });

        // Siparişi de Güncelle (Senkronizasyon)
        if (invoice.orderId) {
            await prisma.order.update({
                where: { id: invoice.orderId },
                data: {
                    finalAmount: parseFloat(data.totalAmount),
                    totalTax: parseFloat(data.taxAmount),
                    // Siparişin içindeki ana notlar/kalemler genelde cargoDetail veya notes içindedir, 
                    // Ancak burada invoice details'i birincil kaynak yapıyoruz.
                    notes: `Düzenlendi: ${new Date().toLocaleString('tr-TR')}`
                }
            });
        }

        res.json({ message: 'Belge ve ilgili sipariş başarıyla güncellendi' });
    } catch (e) {
        res.status(500).json({ error: 'Güncelleme hatası: ' + e.message });
    }
});

// POST /api/invoices/bulk-send - Seçili Belgeleri GİB'e Gönder
router.post('/invoices/bulk-send', requireLogin, requirePermission('invoice.create'), csrfCheck, async (req, res) => {
    try {
        const { ids, uuids } = req.body; // ids öncelikli, geriye dönük uyum için uuids de bakıyoruz
        const targetIds = ids || uuids;

        if (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0) {
            return res.status(400).json({ error: 'Lütfen gönderilecek belgeleri seçin.' });
        }

        const results = [];
        for (const id of targetIds) {
            try {
                // Hem id hem uuid ile arama yapıyoruz (Prisma id genelde uuid stringidir)
                const invoice = await prisma.invoice.findFirst({
                    where: { 
                        OR: [
                            { id: id },
                            { uuid: id }
                        ],
                        tenantId: req.user.tenantId 
                    }
                });

                if (!invoice) {
                    results.push({ id, success: false, error: 'Belge bulunamadı' });
                    continue;
                }

                if (invoice.status === 'SENT') {
                    results.push({ id, success: false, error: 'Zaten gönderilmiş' });
                    continue;
                }

                // Gerçek dünyada burada tekrar entegratörün 'send' servisi çağrılır.
                // Şimdilik simüle ediyoruz ve durumu SENT yapıyoruz.
                await prisma.invoice.updateMany({
                    where: { id: invoice.id, tenantId: req.user.tenantId },
                    data: { status: 'SENT' }
                });

                results.push({ id, success: true, invoiceNo: invoice.invoiceNo });
            } catch (err) {
                results.push({ id, success: false, error: err.message });
            }
        }
        res.json({ message: 'Toplu gönderim tamamlandı', results });
    } catch (e) {
        console.error('Bulk send error:', e);
        res.status(500).json({ error: 'Toplu gönderim sırasında hata: ' + e.message });
    }
});

// POST /api/invoices/sync-inbox - Gelen Alış Faturalarını Çek
router.post('/invoices/sync-inbox', requireLogin, requirePermission('invoice.create'), csrfCheck, async (req, res) => {
    try {
        const tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId } });
        const settings = JSON.parse(tenant.settings || '{}');

        // Servisi çağırıp gelen faturaları alıyoruz
        const incomingInvoices = await EFaturaService.fetchIncomingInvoices(settings);
        let addedCount = 0;

        const mappings = settings.productMappings || {};

        for (const inv of incomingInvoices) {
            // Zaten kayıtlı mı kontrol et
            const exists = await prisma.invoice.findFirst({
                where: { uuid: inv.uuid, tenantId: req.user.tenantId }
            });

            if (!exists) {
                // Kalemleri haritalandır (Mapping uygula)
                const mappedItems = (inv.items || []).map(item => {
                    const supplierKey = `${inv.companyName}`;
                    const mappedCode = (mappings[supplierKey] && mappings[supplierKey][item.code]) 
                                       ? mappings[supplierKey][item.code] 
                                       : item.code;
                    
                    return {
                        ...item,
                        supplierCode: item.code, // Orijinal kodu sakla
                        supplierName: item.name, // Orijinal adı sakla
                        code: mappedCode // Eşleşen kodu kullan
                    };
                });

                await prisma.invoice.create({
                    data: {
                        invoiceNo: inv.invoiceNo,
                        uuid: inv.uuid,
                        type: 'PURCHASE',
                        docType: 'INVOICE',
                        date: new Date(inv.date),
                        companyId: inv.companyName,
                        totalAmount: inv.totalAmount,
                        taxAmount: inv.taxAmount,
                        status: inv.status || 'RECEIVED',
                        details: JSON.stringify(mappedItems.length > 0 ? mappedItems : [{ name: 'Gelen Fatura İçeriği', qty: 1, total: inv.totalAmount }]),
                        tenantId: req.user.tenantId
                    }
                });
                addedCount++;
            }
        }

        res.json({ message: `${addedCount} adet yeni gelen fatura sisteme aktarıldı.` });
    } catch (e) {
        console.error('Inbox sync error:', e);
        res.status(500).json({ error: 'Gelen kutusu taranırken hata oluştu: ' + e.message });
    }
});

// POST /api/invoices/bulk-import-purchase - Alış Faturalarını Toplu İçeri Al (Stok Güncelle)
router.post('/invoices/bulk-import-purchase', requireLogin, requirePermission('invoice.edit'), csrfCheck, async (req, res) => {
    try {
        const { uuids, autoCreateMissing } = req.body;
        if (!uuids || !Array.isArray(uuids)) return res.status(400).json({ error: 'Geçersiz veri' });

        const invoices = await prisma.invoice.findMany({
            where: { uuid: { in: uuids }, tenantId: req.user.tenantId, type: 'PURCHASE', status: { not: 'IMPORTED' } }
        });

        let importedCount = 0;
        let createdProductCount = 0;
        let errors = [];

        for (const inv of invoices) {
            const items = JSON.parse(inv.details || '[]');
            
            // Stok kodlarını kontrol et ve gerekirse oluştur
            let canImport = true;
            for (const item of items) {
                if (!item.code) {
                    canImport = false;
                    errors.push(`${inv.invoiceNo}: Bazı kalemlerde stok kodu eksik.`);
                    break;
                }

                let product = await prisma.product.findFirst({
                    where: { kod: item.code, tenantId: req.user.tenantId }
                });

                if (!product) {
                    if (autoCreateMissing) {
                        // Yeni Ürün Aç
                        await prisma.product.create({
                            data: {
                                kod: item.code,
                                ad: item.name,
                                priceExclTax: parseFloat(item.price || item.priceExclTax) || 0,
                                taxRate: parseFloat(item.taxRate) || 20,
                                stock: 0, // Aşağıda güncellenecek
                                tenantId: req.user.tenantId
                            }
                        });
                        createdProductCount++;
                    } else {
                        canImport = false;
                        errors.push(`${inv.invoiceNo}: '${item.code}' kodlu ürün stokta bulunamadı.`);
                        break;
                    }
                }
            }

            if (!canImport) continue;

            // Stokları Güncelle
            for (const item of items) {
                await prisma.product.updateMany({
                    where: { kod: item.code, tenantId: req.user.tenantId },
                    data: { stock: { increment: parseFloat(item.qty) || 0 } }
                });
            }

            // Durumu Güncelle
            await prisma.invoice.update({
                where: { id: inv.id },
                data: { status: 'IMPORTED' }
            });
            importedCount++;
        }

        res.json({ 
            message: `${importedCount} fatura içeri alındı. ${createdProductCount} yeni ürün kartı otomatik oluşturuldu.`,
            errors: errors.length > 0 ? errors : null
        });
    } catch (e) {
        res.status(500).json({ error: 'İçeri alma hatası: ' + e.message });
    }
});

// POST /api/invoices/save-mapping - Ürün Eşleşmesini Kaydet
router.post('/invoices/save-mapping', requireLogin, requirePermission('invoice.edit'), csrfCheck, async (req, res) => {
    try {
        const { supplierName, supplierCode, myCode } = req.body;
        if (!supplierName || !supplierCode || !myCode) return res.status(400).json({ error: 'Eksik bilgi' });

        const tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId } });
        const settings = JSON.parse(tenant.settings || '{}');
        
        if (!settings.productMappings) settings.productMappings = {};
        if (!settings.productMappings[supplierName]) settings.productMappings[supplierName] = {};
        
        settings.productMappings[supplierName][supplierCode] = myCode;

        await prisma.tenant.update({
            where: { id: req.user.tenantId },
            data: { settings: JSON.stringify(settings) }
        });

        res.json({ message: 'Eşleşme başarıyla kaydedildi. Gelecek faturalarda otomatik hatırlanacak.' });
    } catch (e) {
        res.status(500).json({ error: 'Eşleşme kaydedilemedi: ' + e.message });
    }
});

// GET /api/invoices/:uuid/status - Fatura Durumu Sorgula
router.get('/invoices/:uuid/status', requireLogin, requirePermission('invoice.view'), async (req, res) => {
    try {
        const { uuid } = req.params;
        const tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId } });
        const settings = JSON.parse(tenant.settings || '{}');

        const result = await EFaturaService.queryInvoiceStatus(settings, uuid);

        // Durumu güncelle (Eğer hata varsa ERROR yapalım)
        if (result.status === 'ERROR') {
            await prisma.invoice.updateMany({
                where: { uuid, tenantId: req.user.tenantId },
                data: { status: 'CANCELLED' } // Veya yeni bir 'ERROR' durumu eklenebilir
            });
        }

        res.json(result);
    } catch (e) {
        res.status(500).json({ error: 'Durum sorgulama hatası: ' + e.message });
    }
});

// DELETE /api/invoices/:uuid - Belge Sil
router.delete('/invoices/:uuid', requireLogin, requirePermission('invoice.edit'), csrfCheck, async (req, res) => {
    try {
        const { uuid } = req.params;
        const invoice = await prisma.invoice.findFirst({
            where: { uuid, tenantId: req.user.tenantId }
        });

        if (!invoice) return res.status(404).json({ error: 'Belge bulunamadı' });

        // Sadece taslak veya henüz gönderilmemiş belgeler silinebilir
        if (invoice.status === 'SENT' || invoice.status === 'IMPORTED') {
             return res.status(400).json({ error: 'Gönderilmiş veya stoklara işlenmiş belgeler silinemez. Önce entegratörden iptal edilmelidir.' });
        }

        await prisma.invoice.delete({
            where: { id: invoice.id }
        });

        res.json({ message: 'Belge başarıyla silindi' });
    } catch (e) {
        res.status(500).json({ error: 'Silme hatası: ' + e.message });
    }
});

module.exports = router;
