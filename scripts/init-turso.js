const { createClient } = require('@libsql/client');
const fs = require('fs');
require('dotenv').config();

async function init() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
        console.error('TURSO_DATABASE_URL or TURSO_AUTH_TOKEN missing in .env');
        process.exit(1);
    }

    const client = createClient({ url, authToken });
    const sql = fs.readFileSync('schema.sql', 'utf8');

    console.log('🚀 Initializing Turso database with schema...');
    
    // Split SQL by semicolons, but be careful with multiline or complex SQL.
    // For simple Prisma output, splitting by ; should work.
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    for (const statement of statements) {
        try {
            await client.execute(statement);
            console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
        } catch (e) {
            console.error(`❌ Error executing: ${statement.substring(0, 50)}...`);
            console.error(e.message);
        }
    }

    console.log('✨ Initialization complete!');
    process.exit(0);
}

init();
