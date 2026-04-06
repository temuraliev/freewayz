#!/usr/bin/env node
/**
 * Delete ALL product documents and their referenced image assets from Sanity.
 * This frees up the assets quota so you can re-import with compression.
 *
 * Usage:
 *   node --env-file=.env.local scripts/delete-all-products-and-assets.mjs --confirm
 *
 * Without --confirm the script runs in dry-run mode (shows counts only).
 */

import { createClient } from '@sanity/client';
import { createInterface } from 'readline';

const confirmed = process.argv.includes('--confirm');

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
const token = process.env.SANITY_API_TOKEN;
if (!projectId || !token) {
  console.error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID or SANITY_API_TOKEN');
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: '2024-01-01',
  useCdn: false,
  token,
});

async function askYesNo(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });
}

async function main() {
  console.log('Fetching all products (including drafts)...');

  const products = await client.fetch(
    `*[_type == "product"]{
      _id,
      title,
      "assetIds": images[].asset._ref
    }`
  );

  if (!products?.length) {
    console.log('No products found. Nothing to delete.');
    return;
  }

  const assetIdSet = new Set();
  for (const p of products) {
    if (Array.isArray(p.assetIds)) {
      for (const id of p.assetIds) {
        if (id) assetIdSet.add(id);
      }
    }
  }

  console.log(`\nFound ${products.length} product documents.`);
  console.log(`Found ${assetIdSet.size} unique image assets referenced by products.`);

  if (!confirmed) {
    console.log('\nDry-run mode. Add --confirm to actually delete.');
    console.log('Usage: node --env-file=.env.local scripts/delete-all-products-and-assets.mjs --confirm');
    return;
  }

  const proceed = await askYesNo(
    `\n⚠️  This will permanently delete ${products.length} products and ${assetIdSet.size} assets.\nType "yes" to confirm: `
  );
  if (!proceed) {
    console.log('Aborted.');
    return;
  }

  // ── Delete products ──────────────────────────────────────────────────────
  console.log('\nDeleting products...');
  let productsDeleted = 0;
  let productsFailed = 0;

  for (const p of products) {
    const publishedId = String(p._id).replace(/^drafts\./, '');
    const draftId = `drafts.${publishedId}`;

    try { await client.delete(draftId); } catch {}
    try {
      await client.delete(publishedId);
      productsDeleted++;
    } catch {
      productsFailed++;
    }

    if ((productsDeleted + productsFailed) % 50 === 0) {
      console.log(`  ... ${productsDeleted + productsFailed}/${products.length}`);
    }
  }

  console.log(`Products deleted: ${productsDeleted}, failed: ${productsFailed}`);

  // ── Delete assets ────────────────────────────────────────────────────────
  console.log('\nDeleting image assets...');
  let assetsDeleted = 0;
  let assetsFailed = 0;

  const assetIds = [...assetIdSet];
  for (const assetId of assetIds) {
    try {
      await client.delete(assetId);
      assetsDeleted++;
    } catch {
      assetsFailed++;
    }

    if ((assetsDeleted + assetsFailed) % 50 === 0) {
      console.log(`  ... ${assetsDeleted + assetsFailed}/${assetIds.length}`);
    }
  }

  console.log(`Assets deleted: ${assetsDeleted}, failed: ${assetsFailed}`);

  // ── Orphan assets cleanup ────────────────────────────────────────────────
  console.log('\nLooking for orphaned image assets (not referenced by anything)...');
  const orphans = await client.fetch(
    `*[_type == "sanity.imageAsset" && !defined(*[references(^._id)][0])]{ _id }`
  );

  if (orphans?.length) {
    console.log(`Found ${orphans.length} orphaned assets. Deleting...`);
    let orphansDeleted = 0;
    for (const o of orphans) {
      try {
        await client.delete(o._id);
        orphansDeleted++;
      } catch {}
      if (orphansDeleted % 50 === 0 && orphansDeleted > 0) {
        console.log(`  ... ${orphansDeleted}/${orphans.length}`);
      }
    }
    console.log(`Orphaned assets deleted: ${orphansDeleted}`);
  } else {
    console.log('No orphaned assets found.');
  }

  console.log('\n✅ Done.');
  console.log(`Summary: ${productsDeleted} products, ${assetsDeleted + (orphans?.length || 0)} assets deleted.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
