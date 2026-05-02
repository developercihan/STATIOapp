const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) { console.log('No tenant found'); process.exit(1); }
    
    const invoices = await prisma.invoice.findMany({
        where: { tenantId: tenant.id }
    });
    
    console.log('Tenant ID:', tenant.id);
    console.log('Total Invoices:', invoices.length);
    invoices.forEach(inv => {
        console.log(`- ID: ${inv.id}, No: ${inv.invoiceNo}, Type: ${inv.type}, DocType: ${inv.docType}, Status: ${inv.status}, Amount: ${inv.totalAmount}`);
    });
    process.exit(0);
}

check();
