// Batch update API routes to use session-based auth
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const routeFiles = [
    'src/app/api/receipts/route.ts',
    'src/app/api/receipts/[id]/route.ts',
    'src/app/api/receipts/[id]/image/route.ts',
    'src/app/api/budgets/route.ts',
    'src/app/api/recurring/route.ts',
    'src/app/api/reports/route.ts',
];

function updateRouteFile(filePath) {
    console.log(`\n📝 Updating ${filePath}...`);

    let content = readFileSync(filePath, 'utf-8');
    let changed = false;

    // 1. Remove DEFAULT_USER_ID constant declaration
    if (content.includes('DEFAULT_USER_ID')) {
        content = content.replace(
            /const DEFAULT_USER_ID = .+;[\r\n]+/g,
            ''
        );
        changed = true;
    }

    // 2. Add requireAuth import if not present
    if (!content.includes("from '@/lib/auth'")) {
        // Find the last import statement
        const lastImportMatch = content.match(/import .+ from .+;[\r\n]+(?!import)/);
        if (lastImportMatch) {
            const insertPos = lastImportMatch.index + lastImportMatch[0].length;
            content = content.slice(0, insertPos) +
                "import { requireAuth } from '@/lib/auth';\n" +
                content.slice(insertPos);
            changed = true;
        }
    }

    // 3. Add requireAuth call to each handler function
    const handlers = ['GET', 'POST', 'PUT', 'DELETE'];
    for (const handler of handlers) {
        // Match: export async function HANDLER(...) {\n    try {\n
        const handlerRegex = new RegExp(
            `(export async function ${handler}[^{]+{[\\r\\n]+\\s+try {[\\r\\n]+)(\\s+)`,
            'g'
        );

        if (handlerRegex.test(content)) {
            content = content.replace(handlerRegex, (match, p1, p2) => {
                // Check if requireAuth is already there
                if (content.slice(match.index, match.index + 200).includes('requireAuth')) {
                    return match;
                }
                return `${p1}${p2}const user = await requireAuth(request);\n${p2}`;
            });
            changed = true;
        }
    }

    // 4. Replace DEFAULT_USER_ID with user.id
    if (content.includes('DEFAULT_USER_ID')) {
        content = content.replace(/DEFAULT_USER_ID/g, 'user.id');
        changed = true;
    }

    // 5. Add error handling for Unauthorized
    // Find catch blocks that don't have Unauthorized handling
    const catchBlocks = content.match(/} catch \(error\) {[\s\S]+?console\.error/g);
    if (catchBlocks) {
        catchBlocks.forEach(block => {
            if (!block.includes('Unauthorized') && !block.includes('Not authenticated')) {
                const replacement = block.replace(
                    /} catch \(error\) {[\r\n]+/,
                    `} catch (error) {\n        if (error instanceof Error && error.message === 'Unauthorized') {\n            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });\n        }\n`
                );
                content = content.replace(block, replacement);
                changed = true;
            }
        });
    }

    if (changed) {
        writeFileSync(filePath, content, 'utf-8');
        console.log(`✅ Updated ${filePath}`);
    } else {
        console.log(`⏭️  No changes needed for ${filePath}`);
    }

    return changed;
}

console.log('🚀 Starting batch update of API routes...\n');

let totalUpdated = 0;
for (const file of routeFiles) {
    try {
        const updated = updateRouteFile(file);
        if (updated) totalUpdated++;
    } catch (error) {
        console.error(`❌ Error updating ${file}:`, error.message);
    }
}

console.log(`\n🎉 Batch update complete! Updated ${totalUpdated}/${routeFiles.length} files.`);
console.log('\n💡 Next: Run "npx tsc --noEmit" to check for any remaining issues.');
