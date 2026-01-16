import { createClient } from '@libsql/client';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

const db = createClient({ url, authToken });

async function listTables() {
    try {
        const result = await db.execute("SELECT name FROM sqlite_master WHERE type='table';");
        console.log('Tables in DB:', result.rows.map(r => r.name));
    } catch (e) {
        console.error(e);
    } finally {
        db.close();
    }
}

listTables();
