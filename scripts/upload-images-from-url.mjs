#!/usr/bin/env node
/**
 * Fetch a webpage, extract image URLs, download and upload them to Sanity.
 * By default only "main" product photos are kept (excludes size charts, tags, thumbnails).
 *
 * Usage:
 *   node scripts/upload-images-from-url.mjs [options] <pageUrl>
 *
 * Options:
 *   --max N   Upload at most N images (default: 15 for main-photos-only)
 *   --all     No limit; upload all images that pass the main-photo filter
 *   --no-filter  Include everything (size charts, tags, thumbnails)
 *
 * Example:
 *   node scripts/upload-images-from-url.mjs "https://rainbowreps.x.yupoo.com/albums/198266095"
 *   node scripts/upload-images-from-url.mjs --max 8 "https://..."
 *   node scripts/upload-images-from-url.mjs --all "https://..."
 *
 * Requires .env.local: NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN
 *
 * Disclaimer: Only use on pages you have rights to use. Respect the site's terms of service
 * and copyright. This script is for convenience; you are responsible for legal use.
 */

import { createClient } from '@sanity/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i;
const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// URL path substrings that suggest "not a main product photo" (size chart, tag, thumbnail, etc.)
const EXCLUDE_PATH_PARTS = [
  'small', 'thumb', 'thumbnail', 'size', 'chart', 'tag', 'label', 'care',
  'detail', 'closeup', 'close-up', 'zoom', 'icon',
];

const DEFAULT_MAX_MAIN = 15;

function isLikelyMainPhoto(url) {
  try {
    const path = new URL(url).pathname.toLowerCase();
    for (const part of EXCLUDE_PATH_PARTS) {
      if (path.includes(part)) return false;
    }
    return true;
  } catch (e) {
    return true;
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let pageUrl = null;
  let max = DEFAULT_MAX_MAIN;
  let useFilter = true;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--max' && args[i + 1] != null) {
      max = parseInt(args[i + 1], 10) || DEFAULT_MAX_MAIN;
      i++;
    } else if (a === '--all') {
      max = Infinity;
    } else if (a === '--no-filter') {
      useFilter = false;
    } else if (a.startsWith('http')) {
      pageUrl = a;
    }
  }
  return { pageUrl, max, useFilter };
}

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

function extractImageUrls(html, baseUrl) {
  const base = new URL(baseUrl);
  const seen = new Set();
  const urls = [];

  // img src and data-src
  const srcRegex = /\b(?:src|data-src|data-original)=["']([^"']+)["']/gi;
  let m;
  while ((m = srcRegex.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!IMAGE_EXT.test(raw)) continue;
    try {
      const url = new URL(raw, base).href;
      if (!seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    } catch (e) {}
  }

  // Standalone URLs that look like image URLs (e.g. in JSON or style)
  const urlRegex = /https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|gif|webp|bmp)(\?[^\s"'<>]*)?/gi;
  while ((m = urlRegex.exec(html)) !== null) {
    const url = m[0].replace(/[)\],'"]+$/, '');
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}

function contentTypeFromUrl(url) {
  if (/\.(jpg|jpeg)(\?|$)/i.test(url)) return 'image/jpeg';
  if (/\.png(\?|$)/i.test(url)) return 'image/png';
  if (/\.gif(\?|$)/i.test(url)) return 'image/gif';
  if (/\.webp(\?|$)/i.test(url)) return 'image/webp';
  if (/\.bmp(\?|$)/i.test(url)) return 'image/bmp';
  return 'image/jpeg';
}

function filenameFromUrl(url, index) {
  try {
    const pathname = new URL(url).pathname;
    const name = pathname.split('/').pop() || `image-${index + 1}.jpg`;
    const clean = name.replace(/\?.*$/, '').trim() || `image-${index + 1}.jpg`;
    return clean.length > 0 ? clean : `image-${index + 1}.jpg`;
  } catch (e) {
    return `image-${index + 1}.jpg`;
  }
}

async function main() {
  loadEnvLocal();

  const { pageUrl, max, useFilter } = parseArgs(process.argv);
  if (!pageUrl || !pageUrl.startsWith('http')) {
    console.error('Usage: node scripts/upload-images-from-url.mjs [options] <pageUrl>');
    console.error('Options: --max N (default 15)  --all (no limit)  --no-filter (include size charts, tags, etc.)');
    console.error('Example: node scripts/upload-images-from-url.mjs "https://rainbowreps.x.yupoo.com/albums/198266095"');
    process.exit(1);
  }

  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
  const token = (process.env.SANITY_API_TOKEN || process.env.SANITY_AUTH_TOKEN || '').replace(/\r\n?|\n/g, '').trim();

  if (!projectId || projectId === 'missing-project-id') {
    console.error('Set NEXT_PUBLIC_SANITY_PROJECT_ID in .env.local');
    process.exit(1);
  }
  if (!token) {
    console.error('Set SANITY_API_TOKEN in .env.local');
    process.exit(1);
  }

  const client = createClient({
    projectId,
    dataset,
    apiVersion: '2024-01-01',
    useCdn: false,
    token,
  });

  console.log('Fetching page:', pageUrl);
  let html;
  try {
    const res = await fetch(pageUrl, {
      headers: {
        'User-Agent': DEFAULT_UA,
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    console.error('Failed to fetch page:', e.message);
    process.exit(1);
  }

  let imageUrls = extractImageUrls(html, pageUrl);
  if (imageUrls.length === 0) {
    console.log('No image URLs found on the page. The site may load images via JavaScript.');
    process.exit(0);
  }

  if (useFilter) {
    const before = imageUrls.length;
    imageUrls = imageUrls.filter(isLikelyMainPhoto);
    if (imageUrls.length < before) {
      console.log('Filtered to main photos only:', imageUrls.length, '(excluded', before - imageUrls.length, 'e.g. size charts, tags, thumbnails).');
    }
  }

  if (Number.isFinite(max) && max > 0 && imageUrls.length > max) {
    imageUrls = imageUrls.slice(0, max);
    console.log('Limited to first', max, 'images.');
  }

  if (imageUrls.length === 0) {
    console.log('No images left after filtering. Try --no-filter to include all.');
    process.exit(0);
  }

  console.log('Uploading', imageUrls.length, 'image(s) to Sanity...\n');

  const origin = new URL(pageUrl).origin;
  let ok = 0;
  let err = 0;

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    const name = filenameFromUrl(url, i);
    try {
      const imgRes = await fetch(url, {
        headers: {
          'User-Agent': DEFAULT_UA,
          Referer: origin + '/',
          Accept: 'image/*',
        },
        redirect: 'follow',
      });
      if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      if (buffer.length === 0) throw new Error('Empty response');

      const asset = await client.assets.upload('image', buffer, {
        filename: name,
        contentType: contentTypeFromUrl(url),
      });
      ok++;
      console.log(`[${i + 1}/${imageUrls.length}] ${name} -> ${asset._id}`);
    } catch (e) {
      err++;
      console.error(`[${i + 1}/${imageUrls.length}] ${name} FAILED:`, e && (e.message || String(e)));
    }
  }

  console.log('\nDone. Uploaded:', ok, 'Failed:', err);
  console.log('Open Sanity Studio and assign these assets to products via the Images field.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
