import 'dotenv/config';
import { config } from 'dotenv';
import type { Config } from 'drizzle-kit';

// Load .env.local for drizzle-kit CLI
config({ path: '.env.local' });

export default {
    schema: './src/db/schema.ts',
    out: './drizzle',
    dialect: 'turso',
    dbCredentials: {
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN,
    },
} satisfies Config;
