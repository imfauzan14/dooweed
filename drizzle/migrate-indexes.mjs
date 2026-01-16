// Manual migration script to add indexes to existing Turso database
// Run this with: node drizzle/migrate-indexes.mjs

import { createClient } from '@libsql/client';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function addIndexes() {
    try {
        console.log('🔧 Adding indexes to database...\n');

        const indexes = [
            {
                name: 'idx_receipts_filename',
                sql: 'CREATE INDEX IF NOT EXISTS idx_receipts_filename ON receipts (file_name)',
            },
            {
                name: 'idx_receipts_user',
                sql: 'CREATE INDEX IF NOT EXISTS idx_receipts_user ON receipts (user_id)',
            },
            {
                name: 'idx_transactions_user_date',
                sql: 'CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date)',
            },
            {
                name: 'idx_transactions_category',
                sql: 'CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category_id)',
            },
            {
                name: 'idx_transactions_date',
                sql: 'CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date)',
            },
            {
                name: 'idx_budgets_user_category',
                sql: 'CREATE INDEX IF NOT EXISTS idx_budgets_user_category ON budgets (user_id, category_id)',
            },
        ];

        for (const index of indexes) {
            try {
                await client.execute(index.sql);
                console.log(`✅ Created index: ${index.name}`);
            } catch (error) {
                if (error.message.includes('already exists')) {
                    console.log(`⏭️  Index already exists: ${index.name}`);
                } else {
                    throw error;
                }
            }
        }

        console.log('\n📊 Verifying indexes...');
        const result = await client.execute({
            sql: "SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'",
            args: [],
        });

        console.log('\nExisting indexes:');
        for (const row of result.rows) {
            console.log(`  - ${row.name} on ${row.tbl_name}`);
        }

        console.log('\n✅ Migration completed successfully!');
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        client.close();
    }
}

addIndexes();
