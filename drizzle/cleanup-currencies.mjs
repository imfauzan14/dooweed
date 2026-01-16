
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const dbUrl = process.env.TURSO_DATABASE_URL;
const dbToken = process.env.TURSO_AUTH_TOKEN;

if (!dbUrl || !dbToken) {
    console.error('❌ TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
    process.exit(1);
}

const client = createClient({
    url: dbUrl,
    authToken: dbToken,
});

async function main() {
    console.log('🧹 Starting database clean up of unused currencies (MYR, SGD)...');

    try {
        // 1. Delete from exchange_rates
        const deleteRates = await client.execute({
            sql: "DELETE FROM exchange_rates WHERE base_currency IN ('MYR', 'SGD') OR target_currency IN ('MYR', 'SGD')",
            args: []
        });
        console.log(`✅ Removed ${deleteRates.rowsAffected} rows from exchange_rates.`);

        // 2. Clean up currency_preferences custom_rates
        // We need to fetch, parse, modify, and update because SQLite's JSON support varies and Drizzle stores it as text string mostly
        const prefs = await client.execute("SELECT id, custom_rates FROM currency_preferences");

        let updatedCount = 0;

        for (const row of prefs.rows) {
            if (!row.custom_rates) continue;

            try {
                const rates = JSON.parse(row.custom_rates);
                let modified = false;

                // keys to remove
                const unused = ['MYR', 'SGD'];

                for (const currency of unused) {
                    if (rates[currency]) {
                        delete rates[currency];
                        modified = true;
                    }
                }

                if (modified) {
                    await client.execute({
                        sql: "UPDATE currency_preferences SET custom_rates = ? WHERE id = ?",
                        args: [JSON.stringify(rates), row.id]
                    });
                    updatedCount++;
                }
            } catch (e) {
                console.warn(`⚠️ Failed to parse custom_rates for user ${row.id}`, e);
            }
        }

        console.log(`✅ Updated ${updatedCount} user preferences to remove unused custom rates.`);

    } catch (error) {
        console.error('❌ Cleanup failed:', error);
    } finally {
        client.close();
    }
}

main();
