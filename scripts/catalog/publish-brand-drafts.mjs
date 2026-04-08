#!/usr/bin/env node
/**
 * Publish Sanity product drafts.
 *
 * Usage:
 *   node scripts/catalog/publish-brand-drafts.mjs              # publish ALL drafts
 *   node scripts/catalog/publish-brand-drafts.mjs "Amiri"      # publish drafts of one brand
 */
import { loadEnvLocal } from '../lib/env.mjs';
import { getSanityClient } from '../lib/sanity-client.mjs';

loadEnvLocal();

const client = getSanityClient();
if (!client) {
  console.error('Sanity not configured. Check SANITY_API_TOKEN and NEXT_PUBLIC_SANITY_PROJECT_ID.');
  process.exit(1);
}

async function run() {
  const brandName = process.argv[2];

  let drafts;
  if (brandName) {
    console.log(`🚀 Publishing drafts for brand: "${brandName}"`);
    const brand = await client.fetch(
      '*[_type=="brand" && (title match $name || slug.current == $name)][0]{_id, title}',
      { name: brandName }
    );
    if (!brand) {
      console.error(`❌ Brand "${brandName}" not found.`);
      process.exit(1);
    }
    console.log(`✅ Found brand: ${brand.title} (${brand._id})`);
    drafts = await client.fetch(
      '*[_type=="product" && _id in path("drafts.**") && brand._ref==$brandId]{_id, title}',
      { brandId: brand._id }
    );
  } else {
    console.log('🚀 Publishing ALL product drafts');
    drafts = await client.fetch(
      '*[_type=="product" && _id in path("drafts.**")]{_id, title}'
    );
  }

  if (drafts.length === 0) {
    console.log('✨ No drafts found.');
    return;
  }

  console.log(`📦 Found ${drafts.length} drafts to publish.`);

  let published = 0;
  let failed = 0;

  for (const draft of drafts) {
    const publishedId = draft._id.replace('drafts.', '');

    try {
      const draftContent = await client.getDocument(draft._id);
      if (!draftContent) {
        console.warn(`⚠️  Could not fetch content for ${draft._id}, skipping.`);
        continue;
      }

      // Strip _id and _rev, use published id
      const { _id, _rev, ...content } = draftContent;

      await client.createOrReplace({ ...content, _id: publishedId });
      await client.delete(draft._id);

      published++;
      if (published % 10 === 0 || published === drafts.length) {
        console.log(`   ✅ Published ${published}/${drafts.length}`);
      }
    } catch (err) {
      failed++;
      console.error(`   ❌ Failed "${draft.title}": ${err.message}`);
    }
  }

  console.log(`\n🎉 Done. Published: ${published}, Failed: ${failed}, Total: ${drafts.length}`);
}

run().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
