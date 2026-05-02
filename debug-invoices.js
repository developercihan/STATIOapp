const prisma = require('./services/db.service');
async function main() {
  try {
    const invoices = await prisma.invoice.findMany({
        select: { invoiceNo: true, type: true, totalAmount: true, status: true }
    });
    console.log('Invoices in DB:');
    invoices.forEach(i => {
        console.log(`- No: ${i.invoiceNo}, Type: ${i.type}, Amount: ${i.totalAmount}, Status: ${i.status}`);
    });
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
