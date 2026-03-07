import { createClient } from '@sanity/client';

const client = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
    apiVersion: '2024-01-01',
    useCdn: false,
    token: process.env.SANITY_API_TOKEN,
});

async function run() {
    const products = await client.fetch(`
    *[_type=="product"] {
      "brand": brand->title
    }
  `);

    const counts = {};
    for (const p of products) {
        const b = p.brand || '(без бренда)';
        counts[b] = (counts[b] || 0) + 1;
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    console.log('\n📊 Товары по брендам:');
    console.log('─'.repeat(35));
    for (const [brand, count] of sorted) {
        console.log(`  ${brand.padEnd(20)} ${count}`);
    }
    console.log('─'.repeat(35));
    console.log(`  ${'ИТОГО'.padEnd(20)} ${products.length}`);
}

run();
