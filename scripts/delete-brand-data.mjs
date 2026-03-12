import { createClient } from '@sanity/client';

async function main() {
  const brandSlug = 'denim-tears';
  const client = createClient({
    projectId: 'srd6vsxb',
    dataset: 'production',
    apiVersion: '2024-01-01',
    useCdn: false,
    token: process.env.SANITY_API_TOKEN,
  });

  console.log(`Searching for products of brand: ${brandSlug}...`);

  // 1. Find the brand
  const brand = await client.fetch('*[_type == "brand" && slug.current == $slug][0]', { slug: brandSlug });
  if (!brand) {
    console.error(`Brand ${brandSlug} not found.`);
    return;
  }

  // 2. Find all products and their assets
  const products = await client.fetch(`*[_type == "product" && brand._ref == $brandId]{
    _id,
    "imageAssets": images[].asset._ref,
    "videoAssets": videos[].asset._ref
  }`, { brandId: brand._id });

  if (products.length === 0) {
    console.log('No products found for this brand.');
    return;
  }

  console.log(`Found ${products.length} products. Collecting assets...`);

  const productIds = products.map(p => p._id);
  const assetIds = new Set();
  
  products.forEach(p => {
    if (p.imageAssets) p.imageAssets.forEach(id => assetIds.add(id));
    if (p.videoAssets) p.videoAssets.forEach(id => assetIds.add(id));
  });

  console.log(`Collected ${assetIds.size} unique assets.`);

  // 3. Delete products
  console.log(`Deleting ${productIds.length} products in batches...`);
  for (let i = 0; i < productIds.length; i += 50) {
    const chunk = productIds.slice(i, i + 50);
    const productTx = client.transaction();
    chunk.forEach(id => productTx.delete(id));
    await productTx.commit();
    console.log(`Deleted product chunk ${Math.floor(i/50) + 1}`);
  }
  console.log('Products deleted.');

  // 4. Delete assets
  if (assetIds.size > 0) {
    const assetArray = Array.from(assetIds);
    console.log(`Deleting ${assetArray.length} assets in batches...`);
    
    // Delete in chunks of 50
    for (let i = 0; i < assetArray.length; i += 50) {
        const chunk = assetArray.slice(i, i + 50);
        const assetTx = client.transaction();
        chunk.forEach(id => assetTx.delete(id));
        try {
            await assetTx.commit();
            console.log(`Deleted asset chunk ${Math.floor(i/50) + 1} / ${Math.ceil(assetArray.length/50)}`);
        } catch (e) {
            // Assets might be referenced by other products (not in this brand)
            // or just not exist anymore. We ignore these errors to continue.
            // console.warn(`Note: Could not delete some assets in this chunk (might be in use).`);
        }
    }
    console.log('Asset deletion completed.');
  }

  console.log('Done.');
}

main().catch(console.error);
