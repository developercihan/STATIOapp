/**
 * Turso Migration Script
 * Prisma schema'daki tabloları Turso bulut veritabanında oluşturur.
 */
require('dotenv').config();
const { createClient } = require('@libsql/client');

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

const statements = [
    // Tenant
    `CREATE TABLE IF NOT EXISTS "Tenant" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "officialName" TEXT,
        "taxOffice" TEXT,
        "taxNumber" TEXT,
        "address" TEXT,
        "phone" TEXT,
        "status" TEXT NOT NULL DEFAULT 'active',
        "plan" TEXT NOT NULL DEFAULT 'startup',
        "category" TEXT NOT NULL DEFAULT 'Kırtasiye',
        "subscriptionExpiry" DATETIME,
        "settings" TEXT DEFAULT '{}',
        "ownerEmail" TEXT,
        "ownerName" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    // User
    `CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "username" TEXT NOT NULL,
        "displayName" TEXT NOT NULL,
        "phone" TEXT,
        "email" TEXT,
        "role" TEXT NOT NULL DEFAULT 'distributor',
        "passwordHash" TEXT NOT NULL,
        "permissions" TEXT NOT NULL DEFAULT '[]',
        "warehouseId" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "tenantId" TEXT NOT NULL,
        CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    // Product
    `CREATE TABLE IF NOT EXISTS "Product" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "kod" TEXT NOT NULL,
        "ad" TEXT NOT NULL,
        "priceExclTax" REAL NOT NULL DEFAULT 0,
        "taxRate" REAL NOT NULL DEFAULT 20,
        "stock" INTEGER NOT NULL DEFAULT 0,
        "minStock" INTEGER NOT NULL DEFAULT 10,
        "image" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "tenantId" TEXT NOT NULL,
        CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    // Order
    `CREATE TABLE IF NOT EXISTS "Order" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "distributorCode" TEXT NOT NULL,
        "companyCode" TEXT NOT NULL,
        "orderType" TEXT NOT NULL DEFAULT 'SIPARIS',
        "status" TEXT NOT NULL DEFAULT 'YENI',
        "warehouseId" TEXT,
        "totalAmount" REAL NOT NULL DEFAULT 0,
        "totalTax" REAL NOT NULL DEFAULT 0,
        "finalAmount" REAL NOT NULL DEFAULT 0,
        "notes" TEXT,
        "cargoDetail" TEXT,
        "publicToken" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "tenantId" TEXT NOT NULL,
        "createdBy" TEXT NOT NULL,
        CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Order_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    // OrderItem
    `CREATE TABLE IF NOT EXISTS "OrderItem" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "priceExclTax" REAL NOT NULL DEFAULT 0,
        "qty" INTEGER NOT NULL DEFAULT 1,
        "taxRate" REAL NOT NULL DEFAULT 20,
        "discountRate" REAL NOT NULL DEFAULT 0,
        "lineTotalExcl" REAL NOT NULL DEFAULT 0,
        "lineTax" REAL NOT NULL DEFAULT 0,
        "lineTotal" REAL NOT NULL DEFAULT 0,
        "orderId" TEXT NOT NULL,
        CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    // Company
    `CREATE TABLE IF NOT EXISTS "Company" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "cariKod" TEXT NOT NULL,
        "ad" TEXT NOT NULL,
        "phone" TEXT,
        "email" TEXT,
        "discountRate" REAL NOT NULL DEFAULT 0,
        "taxOffice" TEXT,
        "taxNumber" TEXT,
        "address" TEXT,
        "province" TEXT,
        "district" TEXT,
        "riskLimit" REAL NOT NULL DEFAULT 0,
        "tenantId" TEXT NOT NULL,
        CONSTRAINT "Company_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    // Receivable
    `CREATE TABLE IF NOT EXISTS "Receivable" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "code" TEXT NOT NULL,
        "companyName" TEXT NOT NULL,
        "phone" TEXT,
        "whatsappPhone" TEXT,
        "contactName" TEXT,
        "balance" REAL NOT NULL DEFAULT 0,
        "status" TEXT NOT NULL DEFAULT 'BEKLEMEDE',
        "source" TEXT NOT NULL DEFAULT 'manual',
        "riskLimit" REAL NOT NULL DEFAULT 0,
        "notes" TEXT,
        "lastContactDate" DATETIME,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "tenantId" TEXT NOT NULL,
        CONSTRAINT "Receivable_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    // Transaction
    `CREATE TABLE IF NOT EXISTS "Transaction" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "description" TEXT NOT NULL,
        "relatedId" TEXT,
        "amount" REAL NOT NULL DEFAULT 0,
        "type" TEXT NOT NULL,
        "balanceAfter" REAL NOT NULL DEFAULT 0,
        "receivableId" TEXT NOT NULL,
        CONSTRAINT "Transaction_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "Receivable" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    // Warehouse
    `CREATE TABLE IF NOT EXISTS "Warehouse" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "responsible" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "tenantId" TEXT NOT NULL,
        CONSTRAINT "Warehouse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    // CashTransaction
    `CREATE TABLE IF NOT EXISTS "CashTransaction" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "type" TEXT NOT NULL,
        "cariCode" TEXT NOT NULL,
        "amount" REAL NOT NULL DEFAULT 0,
        "accountType" TEXT,
        "receiptCode" TEXT,
        "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "notes" TEXT,
        "createdBy" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "tenantId" TEXT NOT NULL,
        CONSTRAINT "CashTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    // Note
    `CREATE TABLE IF NOT EXISTS "Note" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "noteNo" TEXT,
        "type" TEXT NOT NULL DEFAULT 'BORC',
        "companyCode" TEXT,
        "companyName" TEXT,
        "amount" REAL NOT NULL DEFAULT 0,
        "currency" TEXT NOT NULL DEFAULT 'TRY',
        "issuedDate" DATETIME,
        "dueDate" DATETIME,
        "paymentStatus" TEXT NOT NULL DEFAULT 'BEKLIYOR',
        "paidAt" DATETIME,
        "description" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "tenantId" TEXT NOT NULL,
        CONSTRAINT "Note_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    // AuditLog
    `CREATE TABLE IF NOT EXISTS "AuditLog" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "userId" TEXT NOT NULL,
        "username" TEXT NOT NULL,
        "role" TEXT NOT NULL,
        "action" TEXT NOT NULL,
        "entityType" TEXT NOT NULL,
        "entityId" TEXT NOT NULL,
        "details" TEXT,
        "tenantId" TEXT NOT NULL,
        CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    // Invoice
    `CREATE TABLE IF NOT EXISTS "Invoice" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "invoiceNo" TEXT,
        "uuid" TEXT,
        "type" TEXT NOT NULL,
        "docType" TEXT NOT NULL DEFAULT 'INVOICE',
        "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "companyId" TEXT NOT NULL,
        "orderId" TEXT,
        "totalAmount" REAL NOT NULL,
        "taxAmount" REAL NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'DRAFT',
        "details" TEXT NOT NULL,
        "carrierInfo" TEXT,
        "xmlPath" TEXT,
        "tenantId" TEXT NOT NULL,
        CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    // PaymentMethod
    `CREATE TABLE IF NOT EXISTS "PaymentMethod" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "tenantId" TEXT NOT NULL,
        CONSTRAINT "PaymentMethod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    // Indexes
    `CREATE UNIQUE INDEX IF NOT EXISTS "Product_kod_tenantId_key" ON "Product"("kod", "tenantId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Order_publicToken_key" ON "Order"("publicToken")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Company_cariKod_tenantId_key" ON "Company"("cariKod", "tenantId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Receivable_code_tenantId_key" ON "Receivable"("code", "tenantId")`,
];

async function migrate() {
    console.log('🚀 Turso Migration başlıyor...');
    console.log(`📡 Bağlanılıyor: ${process.env.TURSO_DATABASE_URL}`);
    
    let success = 0;
    let errors = 0;
    
    for (const sql of statements) {
        try {
            await client.execute(sql);
            const tableName = sql.match(/"(\w+)"/)?.[1] || 'index';
            console.log(`  ✅ ${tableName}`);
            success++;
        } catch (e) {
            console.error(`  ❌ Hata:`, e.message);
            errors++;
        }
    }
    
    console.log(`\n📊 Sonuç: ${success} başarılı, ${errors} hata`);
    
    // Test: Tablolar oluşturuldu mu?
    try {
        const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        console.log('\n📋 Turso\'daki tablolar:');
        result.rows.forEach(r => console.log(`   • ${r.name}`));
    } catch(e) {
        console.error('Tablo listesi alınamadı:', e.message);
    }
    
    process.exit(0);
}

migrate();
