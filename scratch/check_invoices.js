const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const invoices = await prisma.invoice.findMany({ take: 5 });
    console.log('Invoices Count:', await prisma.invoice.count());
    console.log('Sample Invoices:', JSON.stringify(invoices, null, 2));
    process.exit(0);
}

check();
