const fs = require('fs');
const path = require('path');

const pathsToDelete = [
    'public_backup_28nisan',
    'STATIO_ULTRA_SAFE_BACKUP',
    'STATIO',
    'public/index.html.landing',
    'public/siparis.html.order',
    'public/styles.css.neon',
    'check-db.js',
    'debug-invoices.js',
    'reset-pass.js',
    'run-install.js',
    'Siparis_ORD-2026-0006.pdf',
    'replica.db',
    'replica.db-info',
    'replica.db-shm',
    'replica.db-wal'
];

pathsToDelete.forEach(p => {
    const fullPath = path.join(__dirname, p);
    if (fs.existsSync(fullPath)) {
        try {
            if (fs.lstatSync(fullPath).isDirectory()) {
                fs.rmSync(fullPath, { recursive: true, force: true });
                console.log(`DELETED DIR: ${p}`);
            } else {
                fs.unlinkSync(fullPath);
                console.log(`DELETED FILE: ${p}`);
            }
        } catch (e) {
            console.error(`FAILED TO DELETE ${p}: ${e.message}`);
        }
    }
});
