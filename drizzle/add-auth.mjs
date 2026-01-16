// Migration: Add authentication system and wipe existing data
import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config({ path: '.env.local' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function migrate() {
    try {
        console.log('🔧 Starting authentication migration...\n');

        // Step 1: Wipe all existing data
        console.log('🗑️  Wiping existing data...');
        await client.execute('DELETE FROM transactions');
        await client.execute('DELETE FROM receipts');
        await client.execute('DELETE FROM budgets');
        await client.execute('DELETE FROM recurring_transactions');
        await client.execute('DELETE FROM categories');
        await client.execute('DELETE FROM exchange_rates');
        await client.execute('DELETE FROM users');
        console.log('✅ All data wiped\n');

        // Step 2: Add password column to users table (if not exists)
        console.log('🔧 Updating users table...');
        try {
            await client.execute('ALTER TABLE users ADD COLUMN password TEXT NOT NULL DEFAULT ""');
            console.log('✅ Added password column');
        } catch (error) {
            if (error.message.includes('duplicate column')) {
                console.log('⏭️  Password column already exists');
            } else {
                throw error;
            }
        }

        // Make email NOT NULL
        // SQLite doesn't support ALTER COLUMN, so we'll handle this in validation

        // Step 3: Create sessions table
        console.log('\n🔧 Creating sessions table...');
        await client.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
        console.log('✅ Sessions table created');

        // Verify tables
        console.log('\n📊 Verifying tables...');
        const tables = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `);
        console.log('Available tables:');
        for (const row of tables.rows) {
            console.log(`  - ${row.name}`);
        }

        console.log('\n🎉 Migration completed successfully!');
        console.log('\n💡 Next step: Run the app and create your first user via signup page');
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await client.close();
    }
}

migrate();
