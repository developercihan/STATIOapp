const bcrypt = require('bcryptjs');
const prisma = require('./services/db.service');

async function resetPass() {
    try {
        const passwordHash = await bcrypt.hash('admin123', 10);
        const admin = await prisma.user.findFirst({ where: { username: 'admin' } });
        
        if (admin) {
            await prisma.user.update({
                where: { id: admin.id },
                data: { passwordHash }
            });
            console.log('Admin şifresi başarıyla "admin123" olarak güncellendi.');
        } else {
            console.log('Admin kullanıcısı bulunamadı.');
        }
    } catch(e) {
        console.error('Hata:', e);
    } finally {
        await prisma.$disconnect();
    }
}

resetPass();
