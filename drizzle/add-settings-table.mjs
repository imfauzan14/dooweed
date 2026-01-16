// Migration: Add settings table to database
import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config({ path: '.env.local' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function migrate() {
    try {
        console.log('🔧 Creating settings table...\n');

        // Create settings table
        await client.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('✅ Settings table created');

        // Seed default currency fallback rates
        const defaultRates = {
            USD: { IDR: 16850, EUR: 0.93, GBP: 0.79, SGD: 1.35, JPY: 157, CNY: 7.25 },
            EUR: { IDR: 18150, USD: 1.08, GBP: 0.85, SGD: 1.46, JPY: 169 },
            GBP: { IDR: 21350, USD: 1.27, EUR: 1.18, SGD: 1.72 },
            SGD: { IDR: 12470, USD: 0.74, EUR: 0.68, GBP: 0.58 },
            JPY: { IDR: 107, USD: 0.0064, EUR: 0.0059 },
            CNY: { IDR: 2325, USD: 0.14, EUR: 0.13 },
            IDR: {
                USD: 1 / 16850,
                EUR: 1 / 18150,
                GBP: 1 / 21350,
                SGD: 1 / 12470,
                JPY: 1 / 107,
                CNY: 1 / 2325
            },
        };

        await client.execute({
            sql: `INSERT OR IGNORE INTO settings (id, key, value) VALUES (?, ?, ?)`,
            args: ['currency-fallback-rates', 'currencyFallbackRates', JSON.stringify(defaultRates)]
        });
        console.log('✅ Default currency fallback rates seeded');

        console.log('\n🎉 Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await client.close();
    }
}

migrate();
