// Migration: Add isAutomated column to receipts table
import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config({ path: '.env.local' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function addIsAutomatedColumn() {
    try {
        console.log('🔧 Adding isAutomated column to receipts table...\n');

        // Add column (SQLite doesn't support IF NOT EXISTS for ALTER TABLE)
        try {
            await client.execute('ALTER TABLE receipts ADD COLUMN is_automated INTEGER DEFAULT 0');
            console.log('✅ Added is_automated column');
        } catch (error) {
            if (error.message.includes('duplicate column name')) {
                console.log('⏭️  Column is_automated already exists');
            } else {
                throw error;
            }
        }

        // Verify
        const result = await client.execute('PRAGMA table_info(receipts)');
        console.log('\n📊 Receipts table columns:');
        for (const row of result.rows) {
            console.log(`  - ${row.name} (${row.type})`);
        }

        console.log('\n✅ Migration completed successfully!');
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        client.close();
    }
}

addIsAutomatedColumn();
