const { execSync } = require('child_process');

try {
    console.log('Running npm install...');
    execSync('npm install', { stdio: 'inherit' });
    console.log('Running prisma db push...');
    execSync('npx prisma db push', { stdio: 'inherit' });
    console.log('Running prisma generate...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('Running migration...');
    execSync('node scripts/migrate-to-db.js', { stdio: 'inherit' });
    console.log('ALL DONE!');
} catch (e) {
    console.error('Error:', e);
}
