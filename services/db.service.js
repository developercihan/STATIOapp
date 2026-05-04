const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

let prisma;

/**
 * Statio DB Service — SADECE YEREL MOD (HIZLI)
 */
if (process.env.TURSO_DATABASE_URL && process.env.TURSO_DATABASE_URL !== '') {
    // Vercel/Production için Turso Bağlantısı
    const { PrismaLibSQL } = require('@prisma/adapter-libsql');
    const { createClient } = require('@libsql/client');
    
    const libsql = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSQL(libsql);
    prisma = new PrismaClient({ adapter });
    console.log('[DB] Turso Bulut Modu Aktif');
} else {
    // Geliştirme için Yerel SQLite
    prisma = new PrismaClient();
    console.log('[DB] Lokal SQLite Modu Aktif (0ms gecikme) → data/statio.db');
}

module.exports = prisma;
