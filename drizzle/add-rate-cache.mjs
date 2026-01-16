import { createClient } from '@libsql/client';

const db = createClient({
    url: process.env.DATABASE_URL || 'file:local.db'
});

console.log('🔄 Adding exchange_rate_cache table...');

// Create exchange_rate_cache table for shared rate caching
await db.execute(`
  CREATE TABLE IF NOT EXISTS exchange_rate_cache (
    id TEXT PRIMARY KEY,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate REAL NOT NULL,
    source TEXT NOT NULL, -- 'api' or 'llm'
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(from_currency, to_currency, source)
  );
`);

console.log('✅ exchange_rate_cache table created');

// Create index for faster lookups
await db.execute(`
  CREATE INDEX IF NOT EXISTS idx_rate_cache_lookup 
  ON exchange_rate_cache(from_currency, to_currency, source, expires_at);
`);

console.log('✅ Index created');
console.log('🎉 Migration complete!');

db.close();
