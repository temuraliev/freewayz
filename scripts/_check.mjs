import { createClient } from '@sanity/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
// load env
try {
    const content = readFileSync(join(PROJECT_ROOT, '.env.local'), 'utf8');
    for (const line of content.split('\n')) {
        const t = line.trim();
        if (t && !t.startsWith('#')) {
            const eq = t.indexOf('=');
            if (eq > 0) { let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[t.slice(0, eq).trim()] = v.replace(/\r$/, '').trim(); }
        }
    }
} catch { }
const client = createClient({ projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID, dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production', apiVersion: '2024-01-01', useCdn: false, token: (process.env.SANITY_API_TOKEN || '').replace(/\r\n?|\n/g, '').trim() });
const [brands, styles] = await Promise.all([
    client.fetch('*[_type=="brand" && !(_id in path("drafts.**"))]{title,"slug":slug.current}'),
    client.fetch('*[_type=="style" && !(_id in path("drafts.**"))]{title,"slug":slug.current}'),
]);
console.log('Brands:', JSON.stringify(brands.map(b => ({ t: b.title, s: b.slug }))));
console.log('Styles:', JSON.stringify(styles.map(s => ({ t: s.title, s: s.slug }))));
const hasBrand = brands.some(b => b.slug === 'syna-world');
const hasStyle = styles.some(s => s.slug === 'uk-trap');
console.log('syna-world:', hasBrand ? 'EXISTS' : 'MISSING');
console.log('uk-trap:', hasStyle ? 'EXISTS' : 'MISSING');
