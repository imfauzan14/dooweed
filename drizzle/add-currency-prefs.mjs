import { createClient } from '@libsql/client';

const db = createClient({
    url: process.env.DATABASE_URL || 'file:local.db'
});

console.log('🔄 Adding currency_preferences table...');

// Create currency_preferences table
await db.execute(`
  CREATE TABLE IF NOT EXISTS currency_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    fallback_order TEXT NOT NULL,
    enabled_methods TEXT NOT NULL,
    custom_rates TEXT,
    updated_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

console.log('✅ currency_preferences table created');

// Create index on user_id for faster lookups
await db.execute(`
  CREATE INDEX IF NOT EXISTS idx_currency_prefs_user_id ON currency_preferences(user_id);
`);

console.log('✅ Index created');
console.log('🎉 Migration complete!');

db.close();
