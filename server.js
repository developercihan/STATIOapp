const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware'ler
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            "script-src-attr": ["'unsafe-inline'"],
            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            "font-src": ["'self'", "https://fonts.gstatic.com"],
            "img-src": ["'self'", "data:", "blob:"]
        }
    }
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Vercel proxy arkasında çalıştığı için trust proxy gerekli
app.set('trust proxy', 1);

app.use(session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
}));

// Brute-force koruması (Geliştirme aşamasında limiti artırıyoruz)
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 dakika
    limit: 10000, // 10,000 istek/dakika
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});
app.use(limiter);

// Temel Dizinlerin ve Başlangıç Verilerinin Oluşturulması
function initializeAppInfo() {
    // VERCEL ortamında dosya yazma işlemlerini atla (500 hatasını engellemek için)
    if (process.env.VERCEL) return;

    const dataDir = path.join(__dirname, 'data');
    const backupsDir = path.join(dataDir, 'backups');
    const tmpDir = path.join(__dirname, 'tmp');

    // Klasörleri oluştur (Vercel ortamında hata vermemesi için try-catch eklendi)
    try {
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    } catch (e) {
        console.warn('Klasör oluşturma hatası (Muhtemelen salt okunur ortam):', e.message);
    }

    // Kullanıcılar JSON dosyası
    try {
        const usersPath = path.join(dataDir, 'users.json');
        if (!fs.existsSync(usersPath)) {
            let initialPassword = process.env.INITIAL_ADMIN_PASSWORD || 'admin123';
            if (!process.env.INITIAL_ADMIN_PASSWORD) {
                fs.writeFileSync(path.join(dataDir, 'initial_admin_password.txt'), initialPassword);
            }
            
            const passwordHash = bcrypt.hashSync(initialPassword, 10);
            const adminUser = {
                id: `u_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
                username: 'admin',
                displayName: 'Sistem Yöneticisi',
                role: 'admin',
                passwordHash,
                permissions: [],
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            fs.writeFileSync(usersPath, JSON.stringify([adminUser], null, 2));
            console.log('Varsayılan admin kullanıcısı oluşturuldu.');
        }

        // Depolar JSON
        const warehousesPath = path.join(dataDir, 'warehouses.json');
        if (!fs.existsSync(warehousesPath)) {
            const warehouses = [];
            for (let i = 1; i <= 4; i++) {
                warehouses.push({
                    id: `wh_${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${i}`,
                    name: `Depo ${i}`,
                    responsible: '',
                    phone: '',
                    isActive: true,
                    createdAt: new Date().toISOString()
                });
            }
            fs.writeFileSync(warehousesPath, JSON.stringify(warehouses, null, 2));
        }

        // Başlangıç yedeği
        const initialBackupPath = path.join(backupsDir, `${Date.now()}_boot`);
        if (!fs.existsSync(initialBackupPath)) {
            fs.mkdirSync(initialBackupPath, { recursive: true });
            if (fs.existsSync(usersPath)) fs.copyFileSync(usersPath, path.join(initialBackupPath, 'users.json'));
            if (fs.existsSync(warehousesPath)) fs.copyFileSync(warehousesPath, path.join(initialBackupPath, 'warehouses.json'));
        }
    } catch (e) {
        console.warn('Veri başlatma hatası (Muhtemelen salt okunur ortam):', e.message);
    }
}

initializeAppInfo();

// Statik dosyalar
app.use(express.static(path.join(__dirname, 'public')));

// SaaS Uyumlu Resim Servisi: Kullanıcının dükkanına göre resimleri getirir
app.use('/uploads', (req, res, next) => {
    if (req.session && req.session.tenantId) {
        return express.static(path.join(__dirname, 'data', req.session.tenantId, 'uploads'))(req, res, next);
    }
    // Eğer oturum yoksa veya tenantId yoksa global uploads klasörüne bak (varsa)
    express.static(path.join(__dirname, 'data', 'uploads'))(req, res, next);
});

// API Route'ları
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api', require('./routes/data.routes'));
app.use('/api', require('./routes/receivables.routes'));
app.use('/api', require('./routes/admin.routes'));
app.use('/api', require('./routes/cash.routes'));
app.use('/api/superadmin', require('./routes/superadmin.routes'));
app.use('/api/stats', require('./routes/stats.routes'));
app.use('/api/public', require('./routes/public.routes'));

// Fallback (SPA routing için 404)
app.use((req, res) => {
    const p404 = path.join(__dirname, 'public', '404.html');
    if (fs.existsSync(p404)) {
        res.status(404).sendFile(p404);
    } else {
        res.status(404).send('Sayfa bulunamadı.');
    }
});

// Export for Vercel
module.exports = app;

// Sadece Vercel dışındaki ortamlarda listen çalıştır
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Statio Sunucusu port ${PORT} üzerinde çalışıyor.`);
        console.log(`Çalışma ortamı: ${process.env.NODE_ENV || 'development'}`);
    });
}
