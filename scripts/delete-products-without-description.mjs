#!/usr/bin/env node
/**
 * Delete all product documents that have no description (null, undefined, or empty string)
 * and their referenced image assets.
 *
 * Usage:
 *   node --env-file=.env.local scripts/delete-products-without-description.mjs
 *   node --env-file=.env.local scripts/delete-products-without-description.mjs --dry-run
 */

import { createClient } from '@sanity/client';

const ASSET_CONCURRENCY = 10;
const dryRun = process.argv.includes('--dry-run');

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

async function runPool(items, concurrency, fn) {
  const executing = new Set();
  const results = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item)).then((r) => {
      executing.delete(p);
      return r;
    });
    executing.add(p);
    results.push(p);
    if (executing.size >= concurrency) await Promise.race(executing);
  }
  return Promise.all(results);
}

async function main() {
  const products = await client.fetch(
    `*[_type == "product" && (!defined(description) || description == null || description == "")]{
      _id,
      title,
      "slug": slug.current,
      "assetIds": images[].asset._ref
    } | order(_createdAt desc)`
  );

  if (!products?.length) {
    console.log('No products without description found.');
    return;
  }

  const assetIdSet = new Set();
  const productIdsToDelete = new Set();
  for (const p of products) {
    const publishedId = String(p._id).replace(/^drafts\./, '');
    productIdsToDelete.add(publishedId);
    productIdsToDelete.add(`drafts.${publishedId}`);
    if (Array.isArray(p.assetIds)) {
      for (const id of p.assetIds) {
        if (id) assetIdSet.add(id);
      }
    }
  }
  const uniqueProductIds = [...productIdsToDelete];
  const assetIds = [...assetIdSet];

  console.log(`Found ${products.length} product document(s), ${uniqueProductIds.length} id(s) to delete, ${assetIds.length} image assets.`);
  if (dryRun) {
    console.log('--dry-run: skipping actual delete.');
    for (const p of products.slice(0, 5)) {
      console.log(`  - ${p._id} | ${p.title ?? ''} | ${p.slug ?? ''}`);
    }
    if (products.length > 5) console.log(`  ... and ${products.length - 5} more`);
    return;
  }

  console.log('Deleting product documents...');
  let ok = 0;
  const failed = [];
  for (const id of uniqueProductIds) {
    try {
      await client.delete(id);
      ok++;
    } catch (e) {
      failed.push({ id, error: e?.message || String(e) });
    }
  }
  console.log(`Products deleted: ${ok}/${uniqueProductIds.length}`);
  if (failed.length) {
    for (const f of failed) console.log(`  Failed: ${f.id} - ${f.error}`);
  }

  if (assetIds.length > 0) {
    console.log(`Deleting ${assetIds.length} image assets...`);
    const results = await runPool(assetIds, ASSET_CONCURRENCY, async (assetId) => {
      try {
        await client.delete(assetId);
        return 'ok';
      } catch {
        return 'fail';
      }
    });
    const deleted = results.filter((r) => r === 'ok').length;
    console.log(`Assets deleted: ${deleted}/${assetIds.length}`);
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
