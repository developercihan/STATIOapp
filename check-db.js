const prisma = require('./services/db.service');
async function main() {
  try {
    const count = await prisma.paymentMethod.count();
    console.log('PaymentMethod count:', count);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
