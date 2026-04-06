#!/usr/bin/env node
/**
 * Seed brand documents in Sanity (create missing by slug).
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-brands.mjs
 */

import { createClient } from '@sanity/client';

const BRANDS = [
  'Balenciaga',
  'Gallery Dept',
  'Acne Studios',
  'Denim Tears',
  'Corteiz',
  'Syna world',
  'Sp5der',
  'Bape',
  'CDG',
  'Carhart',
  'ERD',
  'Nike',
  'Broken Planet',
  'Stussy',
  'Chrome Hearts',
  'Travis Scott',
  'Trapstar',
  'Vlone',
  'Vetments',
  'Kanye',
  'Fear of God',
  'AMIRI',
  'Hellstar',
  'Ami Paris',
  'Adidas',
  'Casablanca',
  'Evisu',
  'Eric Emanuel',
  'Maison Margiela',
  "Arc'teryx",
  'Stone Island',
  'C.P. Company',
  'Rick Owens',
  'Thug Club',
  'No Faith Studios',
  'Represent',
  'Minus Two',
  'Unknown London',
];

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

function slugify(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')        // remove apostrophes
    .replace(/&/g, 'and')
    .replace(/\./g, '')          // drop dots (cp company -> cp company)
    .replace(/[^a-z0-9]+/g, '-') // non-alnum -> dash
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  const desired = BRANDS.map((title) => ({ title, slug: slugify(title) }));
  const slugs = desired.map((b) => b.slug);

  const existing = await client.fetch(
    `*[_type=="brand" && slug.current in $slugs]{ _id, title, "slug": slug.current }`,
    { slugs }
  );
  const existingSlugs = new Set((existing || []).map((b) => b.slug));

  const toCreate = desired.filter((b) => b.slug && !existingSlugs.has(b.slug));
  console.log(`Existing: ${existingSlugs.size}/${desired.length}. Creating: ${toCreate.length}.`);

  if (toCreate.length === 0) {
    console.log('Nothing to create.');
    return;
  }

  let tx = client.transaction();
  for (const b of toCreate) {
    tx = tx.create({
      _type: 'brand',
      title: b.title,
      slug: { _type: 'slug', current: b.slug },
      isFeatured: false,
    });
  }
  const res = await tx.commit();
  console.log(`Created ${toCreate.length} brands. Transaction: ${res.transactionId}`);
  for (const b of toCreate) console.log(`+ ${b.title} -> ${b.slug}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

