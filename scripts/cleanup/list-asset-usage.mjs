#!/usr/bin/env node
/**
 * Show what is using Sanity assets (who references them).
 * Run when "no orphans" but assets quota is still full.
 *
 * Usage: node --env-file=.env.local scripts/list-asset-usage.mjs
 */

import { createClient } from '@sanity/client';

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

async function main() {
  console.log('Counting assets...\n');

  const [imageCount, fileCount, orphansCount, productsWithImages, brandsWithLogo, categoriesWithImage] = await Promise.all([
    client.fetch('count(*[_type == "sanity.imageAsset"])'),
    client.fetch('count(*[_type == "sanity.fileAsset"])'),
    client.fetch('count(*[_type == "sanity.imageAsset" && !defined(*[references(^._id)][0])])'),
    client.fetch('count(*[_type == "product" && count(images[].asset._ref) > 0])'),
    client.fetch('count(*[_type == "brand" && defined(logo.asset._ref)])'),
    client.fetch('count(*[_type == "category" && defined(image.asset._ref)])'),
  ]);

  console.log('--- Assets ---');
  console.log('Image assets (sanity.imageAsset):', imageCount ?? 0);
  console.log('File assets (sanity.fileAsset, e.g. video):', fileCount ?? 0);
  console.log('Orphaned image assets (no refs):', orphansCount ?? 0);
  console.log('');
  console.log('--- Who references them ---');
  console.log('Products with images:', productsWithImages ?? 0);
  console.log('Brands with logo:', brandsWithLogo ?? 0);
  console.log('Categories with image:', categoriesWithImage ?? 0);

  const totalRefd = (productsWithImages ?? 0) * 1 + (brandsWithLogo ?? 0) + (categoriesWithImage ?? 0);
  console.log('');
  if ((imageCount ?? 0) > 0 && (orphansCount ?? 0) === 0) {
    console.log('All image assets are referenced by documents (no orphans).');
    console.log('Quota is used by: products (main), brands logos, category images.');
    console.log('To free space: delete products (and optionally run delete-orphan-assets) or remove images from documents.');
  }
  if ((fileCount ?? 0) > 0) {
    console.log('File assets (videos, etc.) are not deleted by delete-orphan-assets.mjs; they also use quota.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
