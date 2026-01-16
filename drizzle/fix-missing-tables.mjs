import { createClient } from '@libsql/client';
import { config } from 'dotenv';
import path from 'path';

// Explicitly load .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
    console.error('❌ No DATABASE_URL or TURSO_DATABASE_URL found in environment.');
    process.exit(1);
}

console.log(`🔌 Connecting to database: ${url.replace(/:[^:]*@/, ':***@')}...`);

const db = createClient({
    url,
    authToken
});

async function main() {
    try {
        console.log('🔄 Checking specific tables...');

        // 1. Fix currency_preferences
        // Schema: id, user_id, fallback_order, enabled_methods, custom_rates, updated_at, created_at
        console.log('--- Checking currency_preferences ---');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS currency_preferences (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL UNIQUE, -- Foreign key constraint can be tricky if users doesn't exist, removed explicit REFERENCES for safety in manual script, or keep if bold. Keeping generic for now to ensure creation.
                fallback_order TEXT NOT NULL,
                enabled_methods TEXT NOT NULL,
                custom_rates TEXT,
                updated_at INTEGER, -- timestamp
                created_at INTEGER
            );
        `);
        // Add index
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_currency_prefs_user_id ON currency_preferences(user_id);`);
        console.log('✅ currency_preferences ensured.');

        // 2. Fix exchange_rates
        // Schema: id, base_currency, target_currency, rate, date, fetched_at
        console.log('--- Checking exchange_rates ---');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS exchange_rates (
                id TEXT PRIMARY KEY,
                base_currency TEXT NOT NULL,
                target_currency TEXT NOT NULL,
                rate REAL NOT NULL,
                date TEXT NOT NULL,
                fetched_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ exchange_rates ensured.');

        console.log('\n✨ Manual migration finished successfully.');
    } catch (e) {
        console.error('❌ Migration failed:', e);
        process.exit(1);
    } finally {
        db.close();
    }
}

main();
