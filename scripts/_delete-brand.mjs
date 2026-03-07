import { createClient } from '@sanity/client';

const client = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
    apiVersion: '2024-01-01',
    useCdn: false,
    token: process.env.SANITY_API_TOKEN,
});

const brandName = process.argv[2];
if (!brandName) {
    console.error('Usage: node scripts/_delete-brand.mjs "Corteiz"');
    process.exit(1);
}

async function run() {
    // Find the brand document
    const brand = await client.fetch('*[_type=="brand" && title==$name][0]{_id, title}', { name: brandName });
    if (!brand) {
        console.log(`Brand "${brandName}" not found in Sanity.`);
        process.exit(1);
    }
    console.log(`Found brand: ${brand.title} (${brand._id})`);

    // Find all products referencing this brand
    const products = await client.fetch(
        '*[_type=="product" && brand._ref==$brandId]{_id, title}',
        { brandId: brand._id }
    );
    // Also find drafts
    const drafts = await client.fetch(
        '*[_type=="product" && _id in path("drafts.**") && brand._ref==$brandId]{_id, title}',
        { brandId: brand._id }
    );

    const all = [...products, ...drafts];
    console.log(`Found ${products.length} published + ${drafts.length} draft = ${all.length} total products.`);

    if (all.length === 0) {
        console.log('Nothing to delete.');
        return;
    }

    // Delete in batches of 50
    const batchSize = 10;
    let deleted = 0;
    for (let i = 0; i < all.length; i += batchSize) {
        const batch = all.slice(i, i + batchSize);
        const tx = client.transaction();
        for (const p of batch) {
            tx.delete(p._id);
        }
        await tx.commit();
        deleted += batch.length;
        console.log(`Deleted ${deleted}/${all.length}...`);
        await new Promise(r => setTimeout(r, 200));
    }

    console.log(`✅ Done. Deleted ${deleted} "${brandName}" products.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
