const express = require('express');
const cookieSession = require('cookie-session');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware'ler
app.use(compression());
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            "script-src-attr": ["'unsafe-inline'"],
            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            "font-src": ["'self'", "https://fonts.gstatic.com"],
            "img-src": ["'self'", "data:", "blob:", "https://res.cloudinary.com"]
        }
    }
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Performans Ölçer
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (duration > 500) {
            console.log(`⚠️ SLOW REQUEST: ${req.method} ${req.url} - ${duration}ms`);
        }
    });
    next();
});

// Vercel proxy arkasında çalıştığı için trust proxy gerekli
app.set('trust proxy', 1);

// Cookie-based Session (Vercel Stateless uyumluluğu için)
app.use(cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'statio-super-secret-key'],
    maxAge: 24 * 60 * 60 * 1000, // 24 saat
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    httpOnly: true
}));

// Brute-force koruması: Genel Limit (DDoS ve Scraping Koruması)
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 dakika
    limit: 200, // Her IP için dakikada maksimum istek
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Çok fazla istek gönderdiniz. Lütfen daha sonra tekrar deneyin.' }
});
app.use(limiter);

// Auth Rotası için özel kaba kuvvet (Brute Force) koruması
const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 dakika
    limit: 10, // Login ve Register denemeleri için çok daha kısıtlı
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Çok fazla giriş denemesi yaptınız. Hesabınızın güvenliği için 1 dakika bekleyin.' }
});

// Temel Dizinlerin Oluşturulması
function initializeAppDirs() {
    if (process.env.VERCEL) return;

    const tmpDir = path.join(__dirname, 'tmp');
    try {
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    } catch (e) {
        console.warn('Klasör oluşturma hatası:', e.message);
    }
}

initializeAppDirs();

// Statik dosyalar
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: 0, // Dev: Disable caching for static files
    etag: true
}));

// SaaS Uyumlu Resim Servisi: Kullanıcının dükkanına göre resimleri getirir
app.use('/uploads', (req, res, next) => {
    const opts = { maxAge: '7d', etag: true };
    if (req.session && req.session.tenantId) {
        return express.static(path.join(__dirname, 'data', req.session.tenantId, 'uploads'), opts)(req, res, next);
    }
    // Eğer oturum yoksa veya tenantId yoksa global uploads klasörüne bak (varsa)
    express.static(path.join(__dirname, 'data', 'uploads'), opts)(req, res, next);
});

// API Route'ları
app.use('/api/auth', authLimiter, require('./routes/auth.routes'));
app.use('/api/stats', require('./routes/stats.routes')); // Move stats up
app.use('/api', require('./routes/data.routes'));
app.use('/api', require('./routes/invoice.routes'));
app.use('/api', require('./routes/notes.routes'));
app.use('/api', require('./routes/receivables.routes'));
app.use('/api', require('./routes/admin.routes'));
app.use('/api', require('./routes/integration.routes'));
app.use('/api', require('./routes/cash.routes'));
app.use('/api', require('./routes/payment.routes'));
app.use('/api/superadmin', require('./routes/superadmin.routes'));
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
