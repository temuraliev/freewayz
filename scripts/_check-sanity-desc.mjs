import { createClient } from '@sanity/client';
import { readFileSync } from 'fs';
import { join } from 'path';

function loadEnvLocal() {
    const path = join(process.cwd(), '.env.local');
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
    token: process.env.SANITY_API_TOKEN
});

async function check() {
    const doc = await client.fetch(`
      *[_type == "product"] | order(_updatedAt desc)[0] {
        title,
        description,
        price,
        internalNotes
      }
    `);

    if (!doc) {
        console.log('No products found in Sanity.');
        return;
    }

    console.log('DESCRIPTION:');
    console.log(doc.description || '(empty)');

    console.log('\n================================');
    console.log('PRICE:', doc.price, 'UZS');
    console.log('INTERNAL NOTES (Manager Only):');
    console.log(doc.internalNotes || '(empty)');
}

check();
