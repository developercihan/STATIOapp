const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addMockOrders() {
    const tenantId = 'T001'; // Varsayılan tenant
    const year = new Date().getFullYear();

    const mockOrders = [
        {
            id: `ORD-${year}-0007`,
            source: 'shopify',
            companyCode: 'CARI-001',
            totalAmount: 1250.00,
            totalTax: 250.00,
            finalAmount: 1500.00,
            status: 'YENI',
            notes: 'Shopify #1024 - Global Shipping',
            items: [
                { code: 'ERAS-003', name: 'Sınav Silgisi Beyaz', qty: 10, priceExclTax: 125.00, taxRate: 20, lineTotal: 1500.00 }
            ]
        },
        {
            id: `ORD-${year}-0008`,
            source: 'etsy',
            companyCode: 'CARI-002',
            totalAmount: 2400.00,
            totalTax: 480.00,
            finalAmount: 2880.00,
            status: 'HAZIRLANIYOR',
            notes: 'Etsy Order #E-9921 - Gift Wrap Requested',
            items: [
                { code: 'PEN-001', name: 'Lüks Dolma Kalem', qty: 2, priceExclTax: 1200.00, taxRate: 20, lineTotal: 2880.00 }
            ]
        },
        {
            id: `ORD-${year}-0009`,
            source: 'trendyol',
            companyCode: 'CARI-003',
            totalAmount: 450.00,
            totalTax: 90.00,
            finalAmount: 540.00,
            status: 'ATANDI',
            notes: 'Trendyol TY-44211 - Hızlı Teslimat',
            items: [
                { code: 'NOTE-002', name: 'A5 Çizgili Defter', qty: 5, priceExclTax: 90.00, taxRate: 20, lineTotal: 540.00 }
            ]
        }
    ];

    console.log('🚀 Örnek siparişler enjekte ediliyor...');

    for (const mo of mockOrders) {
        try {
            await prisma.order.upsert({
                where: { id: mo.id },
                update: {},
                create: {
                    id: mo.id,
                    source: mo.source,
                    companyCode: mo.companyCode,
                    distributorCode: 'SYSTEM', // Zorunlu alan eklendi
                    totalAmount: mo.totalAmount,
                    totalTax: mo.totalTax,
                    finalAmount: mo.finalAmount,
                    status: mo.status,
                    notes: mo.notes,
                    tenant: { connect: { id: tenantId } },
                    creator: { connect: { id: 'u_1774354099526_3261215f' } }, // Creator eklendi
                    publicToken: Math.random().toString(36).substring(7),
                    items: {
                        create: mo.items
                    }
                }
            });
            console.log(`✅ ${mo.id} (${mo.source}) eklendi.`);
        } catch (e) {
            console.error(`❌ Hata (${mo.id}):`, e.message);
        }
    }

    console.log('✨ İşlem tamamlandı.');
    await prisma.$disconnect();
}

addMockOrders();
