#!/usr/bin/env node
/**
 * One-time migration:
 * - Find brand "Broken Planet" (by slug/title match)
 * - Find style "graphic" (by slug match)
 * - For all products with that brand: set tier="top" and style=graphic
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate-broken-planet-to-top-graphic.mjs
 */

import { createClient } from '@sanity/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

function loadEnvLocal() {
  try {
    const envPath = join(PROJECT_ROOT, '.env.local');
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {}
}

loadEnvLocal();

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

function pickSingle(list, label) {
  if (!Array.isArray(list) || list.length === 0) return null;
  if (list.length === 1) return list[0];
  console.log(`Found multiple ${label} matches:`);
  for (const x of list) {
    console.log(`- ${x._id} | ${x.title ?? ''} | ${x.slug?.current ?? ''}`);
  }
  console.log(`Please narrow your data (rename/slug) or hardcode the desired ID in this script.`);
  return null;
}

async function main() {
  // Brand: try slug first, then title contains.
  const brandCandidates = await client.fetch(
    `*[_type=="brand" && (slug.current match "broken*" || title match "Broken*Planet*" || title match "broken*planet*")]{ _id, title, slug } | order(title asc)`
  );
  const brand = pickSingle(brandCandidates, 'brand');
  if (!brand?._id) {
    console.error('Could not resolve a unique brand for Broken Planet.');
    process.exit(1);
  }

  // Style: expected slug "graphic"
  const styleCandidates = await client.fetch(
    `*[_type=="style" && (slug.current == "graphic" || title match "graphic*" || title match "Graphic*")]{ _id, title, slug } | order(title asc)`
  );
  const style = pickSingle(styleCandidates, 'style');
  if (!style?._id) {
    console.error('Could not resolve a unique style for graphic.');
    process.exit(1);
  }

  const products = await client.fetch(
    `*[_type=="product" && brand._ref == $brandId]{ _id, title, tier, "styleId": style._ref } | order(_updatedAt desc)`,
    { brandId: brand._id }
  );

  console.log(`Brand: ${brand.title} (${brand.slug?.current ?? ''})`);
  console.log(`Style: ${style.title} (${style.slug?.current ?? ''})`);
  console.log(`Found ${products.length} products for this brand.`);

  if (products.length === 0) {
    console.log('Nothing to migrate.');
    return;
  }

  let tx = client.transaction();
  for (const p of products) {
    tx = tx.patch(p._id, (patch) =>
      patch.set({
        tier: 'top',
        style: { _type: 'reference', _ref: style._id },
      })
    );
  }

  const result = await tx.commit();
  console.log(`Migration complete. Updated ${products.length} products: tier="top", style="graphic".`);
  console.log(`Transaction ID: ${result.transactionId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

