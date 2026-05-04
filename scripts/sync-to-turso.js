/**
 * Statio — Lokal SQLite → Turso Data Migration
 * Mevcut veritabanındaki tüm verileri Turso bulut veritabanına kopyalar.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaLibSQL } = require('@prisma/adapter-libsql');
const { createClient } = require('@libsql/client');

// Kaynak: Lokal SQLite
const localPrisma = new PrismaClient();

// Hedef: Turso
const libsql = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});
const adapter = new PrismaLibSQL(libsql);
const tursoPrisma = new PrismaClient({ adapter });

const TABLES = [
    { name: 'Tenant', model: 'tenant' },
    { name: 'User', model: 'user' },
    { name: 'Product', model: 'product' },
    { name: 'Company', model: 'company' },
    { name: 'Warehouse', model: 'warehouse' },
    { name: 'PaymentMethod', model: 'paymentMethod' },
    { name: 'Receivable', model: 'receivable' },
    { name: 'Order', model: 'order' },
    { name: 'OrderItem', model: 'orderItem' },
    { name: 'Transaction', model: 'transaction' },
    { name: 'CashTransaction', model: 'cashTransaction' },
    { name: 'Note', model: 'note' },
    { name: 'Invoice', model: 'invoice' },
    { name: 'AuditLog', model: 'auditLog' },
];

async function migrate() {
    console.log('🔄 Lokal SQLite → Turso veri taşıma başlıyor...\n');
    
    for (const table of TABLES) {
        try {
            // Lokal veritabanından oku
            const records = await localPrisma[table.model].findMany();
            
            if (records.length === 0) {
                console.log(`  ⏭️  ${table.name}: Boş (atlandı)`);
                continue;
            }

            // Turso'ya yaz
            let written = 0;
            for (const record of records) {
                try {
                    await tursoPrisma[table.model].create({ data: record });
                    written++;
                } catch (e) {
                    // Zaten varsa atla (duplicate key)
                    if (e.message.includes('Unique constraint') || e.message.includes('UNIQUE')) {
                        continue;
                    }
                    console.error(`    ⚠️ ${table.name} kayıt hatası:`, e.message.slice(0, 100));
                }
            }
            
            console.log(`  ✅ ${table.name}: ${written}/${records.length} kayıt taşındı`);
        } catch (e) {
            console.error(`  ❌ ${table.name}: HATA —`, e.message.slice(0, 120));
        }
    }

    // Doğrulama
    console.log('\n📊 Turso Doğrulama:');
    for (const table of TABLES) {
        try {
            const count = await tursoPrisma[table.model].count();
            if (count > 0) console.log(`  📋 ${table.name}: ${count} kayıt`);
        } catch(e) {}
    }

    console.log('\n✅ Veri taşıma tamamlandı!');
    
    await localPrisma.$disconnect();
    await tursoPrisma.$disconnect();
    process.exit(0);
}

migrate().catch(e => {
    console.error('Migration hatası:', e);
    process.exit(1);
});
