#!/usr/bin/env node
/**
 * Delete all product documents for a given brand (by brand slug or title match).
 *
 * Usage:
 *   node --env-file=.env.local scripts/delete-products-by-brand.mjs "Syna world"
 *   node --env-file=.env.local scripts/delete-products-by-brand.mjs syna-world
 */

import { createClient } from '@sanity/client';

const input = (process.argv.slice(2).join(' ') || '').trim();
if (!input) {
  console.error('Pass brand name or slug. Example: node --env-file=.env.local scripts/delete-products-by-brand.mjs "Syna world"');
  process.exit(1);
}

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

function norm(s) {
  return String(s || '').toLowerCase().trim();
}

async function main() {
  const q = norm(input);

  const brands = await client.fetch(
    `*[_type=="brand" && (
        slug.current == $q
        || lower(slug.current) == $q
        || lower(title) == $q
        || lower(title) match $q
        || lower(title) match $qLike
      )] | order(title asc) { _id, title, slug }`,
    { q, qLike: `*${q}*` }
  );

  if (!brands?.length) {
    console.error(`Brand not found for: "${input}"`);
    process.exit(1);
  }
  if (brands.length > 1) {
    console.error(`Multiple brands matched "${input}". Refine input to exact slug/title.`);
    for (const b of brands) console.error(`- ${b._id} | ${b.title} | ${b.slug?.current ?? ''}`);
    process.exit(1);
  }

  const brand = brands[0];
  console.log(`Brand: ${brand.title} (${brand.slug?.current ?? ''}) [${brand._id}]`);

  const products = await client.fetch(
    `*[_type=="product" && brand._ref == $brandId]{
      _id,
      title,
      "slug": slug.current
    } | order(_createdAt desc)`,
    { brandId: brand._id }
  );

  if (!products?.length) {
    console.log('No products found for this brand.');
    return;
  }

  console.log(`Found ${products.length} products. Deleting...`);

  let ok = 0;
  const failed = [];

  for (const p of products) {
    const publishedId = String(p._id).replace(/^drafts\./, '');
    const draftId = `drafts.${publishedId}`;

    try { await client.delete(draftId); } catch {}
    try {
      await client.delete(publishedId);
      ok++;
    } catch (e) {
      failed.push({ id: publishedId, title: p.title, slug: p.slug, error: e?.message || String(e) });
    }
  }

  console.log(`Deleted: ${ok}/${products.length}`);
  if (failed.length) {
    console.log('Failed to delete:');
    for (const f of failed) {
      console.log(`- ${f.id} | ${f.title ?? ''} | ${f.slug ?? ''} | ${f.error}`);
    }
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

