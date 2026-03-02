#!/usr/bin/env node
/**
 * Enrich existing Sanity products with Gemini: fill title, description, subtype,
 * category, style, brand, colors, and optionally price from AI using first product image.
 *
 * Usage:
 *   node --env-file=.env.local scripts/enrich-products-with-gemini.mjs [options]
 *
 * Options:
 *   --limit N   Process at most N products (default: all that match filter)
 *   --dry-run   Log what would be updated, do not patch Sanity
 *
 * Requires .env.local: NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET,
 * SANITY_API_TOKEN, GEMINI_API_KEY.
 */

import { createClient } from '@sanity/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import {
  callGeminiForProduct,
  calculatePriceUzs,
  guessWeightKg,
  roundPriceToNiceUzs,
} from './lib/gemini-enrich.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

function loadEnvLocal() {
  const path = join(PROJECT_ROOT, '.env.local');
  try {
    const content = readFileSync(path, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eq = trimmed.indexOf('=');
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          let value = trimmed.slice(eq + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
            value = value.slice(1, -1);
          process.env[key] = value.replace(/\r$/, '').trim();
        }
      }
    }
  } catch (e) {}
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  loadEnvLocal();

  const args = process.argv.slice(2).filter((a) => !a.startsWith('--env-file'));
  let limit = null;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
  const token = (process.env.SANITY_API_TOKEN || '').replace(/\r\n?|\n/g, '').trim();
  const keysEnv = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  const apiKeys = keysEnv
    .split(',')
    .map((k) => k.replace(/\r\n?|\n/g, '').trim())
    .filter(Boolean);

  if (!projectId || !token) {
    console.error('Set NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_TOKEN in .env.local');
    process.exit(1);
  }
  if (apiKeys.length === 0) {
    console.error('Set GEMINI_API_KEY or GEMINI_API_KEYS in .env.local (Google AI Studio).');
    process.exit(1);
  }

  const client = createClient({
    projectId,
    dataset,
    apiVersion: '2024-01-01',
    useCdn: false,
    token,
  });

  const productsQuery = `*[_type == "product" && defined(images) && count(images) > 0 && (!defined(description) || description == "")][0...${limit != null ? limit : 50}]{
    _id,
    title,
    price,
    description,
    subtype,
    "category": category->{ _id, title, "slug": slug.current },
    "style": style->{ _id, title, "slug": slug.current },
    "brand": brand->{ _id, title, "slug": slug.current },
    colors,
    "firstImageUrl": images[0].asset->url
  }`;

  const products = await client.fetch(productsQuery);
  if (!products?.length) {
    console.log('No products with images found.');
    return;
  }

  const [categoriesList, stylesList, brandsList, examples] = await Promise.all([
    client.fetch('*[_type == "category"]{ _id, title, "slug": slug.current, subtypes }'),
    client.fetch('*[_type == "style"]{ _id, title, "slug": slug.current }'),
    client.fetch('*[_type == "brand"]{ _id, title, "slug": slug.current }'),
    client.fetch(
      '*[_type == "product" && defined(description) && description != ""][0...3]{ title, description, subtype, "category": category->title, "style": style->title, "brand": brand->title, colors }'
    ),
  ]);

  const aiContext = {
    apiKeys,
    categories: categoriesList || [],
    styles: stylesList || [],
    brands: brandsList || [],
    exampleProducts: examples || [],
  };

  console.log('Products to process:', products.length, dryRun ? '(dry-run)' : '');
  let updated = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const imageUrl = p.firstImageUrl;
    if (!imageUrl) continue;

    console.log('\n[' + (i + 1) + '/' + products.length + ']', p._id, p.title?.slice(0, 40));

    let imageBase64;
    try {
      const res = await fetch(imageUrl, { headers: { Accept: 'image/*' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = await res.arrayBuffer();
      imageBase64 = Buffer.from(buf).toString('base64');
    } catch (e) {
      console.log('  Skip: could not fetch image', e.message);
      continue;
    }

    const brandName = p.brand?.title || '';
    const priceYuan = null;

    const aiResult = await callGeminiForProduct({
      imageBase64,
      title: p.title,
      priceYuan,
      brandName,
      categories: aiContext.categories,
      styles: aiContext.styles,
      brands: aiContext.brands,
      exampleProducts: aiContext.exampleProducts,
      apiKeys: aiContext.apiKeys,
    });

    if (!aiResult) {
      console.log('  No AI result. Skip.');
      continue;
    }

    let categoryId = p.category?._id;
    let styleId = p.style?._id;
    let brandId = p.brand?._id;
    if (aiResult.categorySlug && aiContext.categories) {
      const cat = aiContext.categories.find((c) => c.slug === aiResult.categorySlug);
      if (cat?._id) categoryId = cat._id;
    }
    if (aiResult.styleSlug && aiContext.styles) {
      const st = aiContext.styles.find((s) => s.slug === aiResult.styleSlug);
      if (st?._id) styleId = st._id;
    }
    if (aiResult.brandSlug && aiContext.brands) {
      const br = aiContext.brands.find((b) => b.slug === aiResult.brandSlug);
      if (br?._id) brandId = br._id;
    }

    const patch = {
      title: aiResult.title ? String(aiResult.title).slice(0, 90) : p.title,
      description: aiResult.description != null ? String(aiResult.description) : p.description,
      subtype: aiResult.subtype != null ? String(aiResult.subtype) : p.subtype,
      colors: Array.isArray(aiResult.colors) && aiResult.colors.length > 0 ? aiResult.colors.map(String) : p.colors,
    };
    if (categoryId) patch.category = { _type: 'reference', _ref: categoryId };
    if (styleId) patch.style = { _type: 'reference', _ref: styleId };
    if (brandId) patch.brand = { _type: 'reference', _ref: brandId };
    if (aiResult.priceUzs != null && Number.isFinite(Number(aiResult.priceUzs))) {
      patch.price = roundPriceToNiceUzs(Math.round(Number(aiResult.priceUzs)));
    }

    if (dryRun) {
      console.log('  Would patch:', JSON.stringify(patch, null, 2).slice(0, 300) + '...');
    } else {
      await client.patch(p._id).set(patch).commit();
      updated++;
      console.log('  Updated.');
    }

    await sleep(10000);
  }

  console.log('\nDone. Updated:', updated);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
