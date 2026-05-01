const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const dataAccess = require('../services/dataAccess');

const prisma = new PrismaClient();

async function main() {
    console.log('Veritabanı göç işlemi (Migration) başlıyor...');

    // 1. Tenants
    const tenantsPath = path.join(__dirname, '..', 'data', 'tenants.json');
    if (fs.existsSync(tenantsPath)) {
        const tenants = JSON.parse(fs.readFileSync(tenantsPath, 'utf8'));
        for (const t of tenants) {
            await prisma.tenant.upsert({
                where: { id: t.id },
                update: {},
                create: {
                    id: t.id,
                    name: t.name,
                    officialName: t.officialName,
                    taxOffice: t.taxOffice,
                    taxNumber: t.taxNumber,
                    address: t.address,
                    phone: t.phone,
                    status: t.status,
                    plan: t.plan,
                    category: t.category,
                    subscriptionExpiry: t.subscriptionExpiry ? new Date(t.subscriptionExpiry) : null,
                    ownerEmail: t.ownerEmail,
                    ownerName: t.ownerName,
                    createdAt: t.createdAt ? new Date(t.createdAt) : new Date()
                }
            });
        }
        console.log(`✅ ${tenants.length} Mağaza (Tenant) aktarıldı.`);
    }

    // 2. Users (Global)
    const usersPath = path.join(__dirname, '..', 'data', 'users.json');
    if (fs.existsSync(usersPath)) {
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        for (const u of users) {
            // Check if tenant exists
            const tenantExists = await prisma.tenant.findUnique({ where: { id: u.tenantId } });
            if (!tenantExists) continue;

            await prisma.user.upsert({
                where: { id: u.id },
                update: {},
                create: {
                    id: u.id,
                    username: u.username,
                    displayName: u.displayName,
                    role: u.role,
                    passwordHash: u.passwordHash,
                    permissions: JSON.stringify(u.permissions || []),
                    warehouseId: u.warehouseId,
                    isActive: u.isActive,
                    tenantId: u.tenantId,
                    createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
                    updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date()
                }
            });
        }
        console.log(`✅ Kullanıcılar aktarıldı.`);
    }

    // Tenant bazlı verileri aktarma
    const tenants = await prisma.tenant.findMany();
    for (const tenant of tenants) {
        console.log(`\n➡️ ${tenant.name} mağazasının verileri aktarılıyor...`);
        const tDir = path.join(__dirname, '..', 'data', tenant.id);
        if (!fs.existsSync(tDir)) continue;

        // Warehouses
        const whPath = path.join(tDir, 'warehouses.json');
        if (fs.existsSync(whPath)) {
            const whs = JSON.parse(fs.readFileSync(whPath, 'utf8'));
            for (const w of whs) {
                await prisma.warehouse.upsert({
                    where: { id: w.id },
                    update: {},
                    create: {
                        id: w.id,
                        name: w.name,
                        responsible: w.responsible,
                        isActive: w.isActive,
                        tenantId: tenant.id,
                        createdAt: w.createdAt ? new Date(w.createdAt) : new Date()
                    }
                });
            }
        }

        // Products
        const prodPath = path.join(tDir, 'products.json');
        if (fs.existsSync(prodPath)) {
            const prods = JSON.parse(fs.readFileSync(prodPath, 'utf8'));
            for (const p of prods) {
                await prisma.product.upsert({
                    where: { kod_tenantId: { kod: p.kod, tenantId: tenant.id } },
                    update: {},
                    create: {
                        kod: p.kod,
                        ad: p.ad,
                        priceExclTax: parseFloat(p.priceExclTax) || 0,
                        taxRate: parseFloat(p.taxRate) || 20,
                        stock: p.stock || 0,
                        minStock: p.minStock || 10,
                        image: p.image,
                        tenantId: tenant.id
                    }
                });
            }
        }

        // Companies
        const compPath = path.join(tDir, 'companies.json');
        if (fs.existsSync(compPath)) {
            const comps = JSON.parse(fs.readFileSync(compPath, 'utf8'));
            for (const c of comps) {
                await prisma.company.upsert({
                    where: { cariKod_tenantId: { cariKod: c.cariKod, tenantId: tenant.id } },
                    update: {},
                    create: {
                        cariKod: c.cariKod,
                        ad: c.ad,
                        phone: c.phone,
                        email: c.email,
                        discountRate: parseFloat(c.discountRate) || 0,
                        taxOffice: c.taxOffice,
                        taxNumber: c.taxNumber,
                        address: c.address,
                        riskLimit: parseFloat(c.riskLimit) || 0,
                        tenantId: tenant.id
                    }
                });
            }
        }
    }

    console.log('\n🚀 GÖÇ İŞLEMİ TAMAMLANDI! Artık tüm veriler SQLite veritabanında.');
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
