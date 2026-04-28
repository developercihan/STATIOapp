const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const usersPath = path.join(__dirname, 'data', 'users.json');
try {
    const users = JSON.parse(fs.readFileSync(usersPath));
    const admin = users.find(u => u.username === 'admin');
    if (admin) {
        admin.passwordHash = bcrypt.hashSync('admin123', 10);
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        console.log('Şifre başarıyla güncellendi.');
    }
} catch(e) { console.error(e); }
