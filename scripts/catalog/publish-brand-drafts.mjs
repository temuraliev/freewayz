import { createClient } from '@sanity/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

function loadEnvLocal() {
    const path = join(PROJECT_ROOT, '.env.local');
    try {
        const content = readFileSync(path, 'utf8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const eq = trimmed.indexOf('=');
                if (eq > 0) {
                    const key = trimmed.slice(0, eq).trim();
                    let value = trimmed.slice(eq + 1).trim();
                    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
                        value = value.slice(1, -1);
                    process.env[key] = value.replace(/\r$/, '').trim();
                }
            }
        }
    } catch (e) { }
}

loadEnvLocal();

const token = (process.env.SANITY_API_TOKEN || '').replace(/\r\n?|\n/g, '').trim();
console.log('Using token:', token ? `set (${token.length} chars, starts with ${token.slice(0, 4)}...)` : 'MISSING');

const client = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
    apiVersion: '2024-01-01',
    useCdn: false,
    token,
});

async function run() {
    const brandName = process.argv[2] || "Denim Tears";
    console.log(`🚀 Starting publication for brand: "${brandName}"`);

    // 1. Find the brand
    const brand = await client.fetch('*[_type=="brand" && (title match $name || slug.current == $name)][0]{_id, title}', { name: brandName });

    if (!brand) {
        console.error(`❌ Brand "${brandName}" not found in Sanity.`);
        process.exit(1);
    }

    console.log(`✅ Found brand: ${brand.title} (${brand._id})`);

    // 2. Find all draft products for this brand
    const drafts = await client.fetch(
        '*[_type=="product" && _id in path("drafts.**") && brand._ref==$brandId]{_id, title}',
        { brandId: brand._id }
    );

    if (drafts.length === 0) {
        console.log('✨ No drafts found for this brand.');
        return;
    }

    console.log(`📦 Found ${drafts.length} drafts to publish.`);

    // 3. Publish drafts sequentially
    let published = 0;
    for (const draft of drafts) {
        const publishedId = draft._id.replace('drafts.', '');

        try {
            // Fetch core draft content
            const draftContent = await client.getDocument(draft._id);
            if (!draftContent) {
                console.warn(`⚠️ Could not get content for ${draft._id}, skipping.`);
                continue;
            }

            // Remove the _id and _rev from draft content
            const { _id, _rev, ...content } = draftContent;

            console.log(`   🔸 Publishing: ${draft.title}...`);
            await client.createOrReplace({
                ...content,
                _id: publishedId,
            });

            // Delete the draft document
            await client.delete(draft._id);
            published++;
            console.log(`      ✅ Published ${published}/${drafts.length}`);
        } catch (err) {
            console.error(`      ❌ Failed to publish ${draft.title}: ${err.message}`);
        }
    }

    console.log(`\n🎉 Done! Published ${published} products for "${brand.title}".`);
}

run().catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
