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

const client = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
    apiVersion: '2024-01-01',
    useCdn: false,
    token: process.env.SANITY_API_TOKEN,
});

async function run() {
    const brandName = "Denim Tears";
    console.log(`Searching for brand: "${brandName}"`);

    const brand = await client.fetch('*[_type=="brand" && title match $name][0]{_id, title}', { name: brandName });

    if (!brand) {
        console.log('Brand not found');
        return;
    }

    console.log('Found brand:', brand);

    const drafts = await client.fetch(
        '*[_type=="product" && _id in path("drafts.**") && brand._ref==$brandId]{_id, title}',
        { brandId: brand._id }
    );

    console.log(`Found ${drafts.length} drafts`);
    drafts.forEach(d => console.log(` - ${d.title} (${d._id})`));
}

run().catch(console.error);
