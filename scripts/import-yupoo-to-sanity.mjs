#!/usr/bin/env node
/**
 * Import products from a Yupoo category or album: fetch high-quality images,
 * download them, upload to Sanity, enrich with Gemini AI, create product docs.
 *
 * v2 improvements:
 *   - Multi-image AI: sends up to 4 images to Gemini for better accuracy
 *   - Deduplication: skips albums already imported (by sourceUrl)
 *   - Parallel image downloads (3 at a time)
 *   - Auto-publish mode (--publish)
 *   - Progress saving: resume interrupted imports
 *   - Fetches real published products as AI examples (few-shot learning)
 *   - Faster: reduced delays (2s between AI calls, 300ms between HTTP)
 *
 * Usage:
 *   node --env-file=.env.local scripts/import-yupoo-to-sanity.mjs <categoryOrAlbumUrl> [options]
 *
 * Options:
 *   --from N --to M  Import albums from position N to M (e.g. --from 1 --to 10).
 *   --max N          Alternative: max products (same as --from 1 --to N). Default 5.
 *   --brand SLUG     Brand slug in Sanity (e.g. hellstar). Used as hint for AI.
 *   --category SLUG  Category slug in Sanity (e.g. hoodies). Used as hint for AI.
 *   --style SLUG     Style slug in Sanity (e.g. opium). Used as hint for AI.
 *   --ai             Enable Gemini AI enrichment (title, description, price, etc.)
 *   --publish        Publish immediately (no drafts prefix). Default: create drafts.
 *   --resume         Resume from last progress checkpoint.
 *
 * Slug format: category_style_brand_<number>.
 *
 * Examples:
 *   ... "https://pengreps.x.yupoo.com/categories/4830286" --from 1 --to 50 --brand mertra --style uk-drill --ai --publish
 *   ... "https://elephant-brother.x.yupoo.com/" --max 90 --ai
 *   ... "https://any-supplier.x.yupoo.com/albums/123456" --from 1 --to 1 --brand hellstar --ai
 */

import { createClient } from '@sanity/client';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import {
  callGeminiForProduct,
  calculatePriceUzs,
  guessWeightKg,
  roundPriceToNiceUzs,
  normalizeSubtype,
} from './lib/gemini-enrich.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const PROGRESS_FILE = join(PROJECT_ROOT, '.yupoo-progress.json');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const BROWSER_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'max-age=0',
  'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1'
};

const DELAY_MS = 500;
const AI_DELAY_MS = 500;
const DEFAULT_MAX_PRODUCTS = 5;
const DEFAULT_PRICE_UZS = 200_000;
const YUAN_TO_UZS = 1_600;
/** Skip images smaller than this (bytes). 200 KB = 204800 */
const MIN_IMAGE_SIZE_BYTES = 200 * 1024;
/** Max images to send to Gemini for analysis */
const MAX_AI_IMAGES = 4;
/** Max parallel image downloads */
const PARALLEL_DOWNLOADS = 3;

import { chromium } from 'playwright';

// Global Playwright context
let browser = null;
let browserContext = null;

async function initBrowser() {
  if (browser) return;
  browser = await chromium.launch({ headless: true });
  browserContext = await browser.newContext({
    userAgent: USER_AGENT,
    extraHTTPHeaders: {
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    }
  });
}

async function closeBrowser() {
  if (browser) await browser.close();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  } catch (e) { }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function resolveUrl(url, base) {
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

/** Parse price from title: "¥~158" / "￥329" -> 158; "P209 6402-89L" (tophotfashion etc.) -> 209 */
function parsePriceFromTitle(title) {
  if (!title || typeof title !== 'string') return null;
  const m = title.match(/[¥￥]\s*\\?~?\s*(\d+)/);
  if (m) return parseInt(m[1], 10);
  const mP = title.match(/\bP\s*(\d+)\b/);
  if (mP) return parseInt(mP[1], 10);
  return null;
}

/** Get raw album title from page HTML (no cleanTitle) for discount detection */
function getRawAlbumTitle(html) {
  const $ = cheerio.load(html);
  return ($('title').text() || $('meta[property="og:title"]').attr('content') || '').trim();
}

/** Detect if raw title/text indicates a discount/sale (e.g. "Discount price", "%OFF", "SALE") */
function isDiscountFromTitle(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.toLowerCase();
  const patterns = [
    /discount/i,
    /\d+%\s*off/i,
    /off\s*discount/i,
    /super\s*discount/i,
    /【[^】]*discount[^】]*】/i,
    /\bsale\b/i,
    /скидк/i,
    /特价/,
    /折扣/,
    /%\s*off\s*discount/i,
  ];
  return patterns.some((p) => p.test(t));
}

/** Median of array of numbers */
function median(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Get typical (median) price in UZS for products with same brand and subtype in Sanity. Returns null if none. */
async function getTypicalPriceForBrandSubtype(client, brandRefId, subtype) {
  if (!brandRefId) return null;
  const query = subtype
    ? `*[_type == "product" && !(_id in path("drafts.**")) && brand._ref == $brandId && subtype == $subtype]{ price }`
    : `*[_type == "product" && !(_id in path("drafts.**")) && brand._ref == $brandId]{ price }`;
  const params = subtype ? { brandId: brandRefId, subtype } : { brandId: brandRefId };
  try {
    const rows = await client.fetch(query, params);
    const prices = (rows || []).map((r) => r?.price).filter((p) => typeof p === 'number' && Number.isFinite(p));
    const med = median(prices);
    return med != null ? Math.round(med) : null;
  } catch {
    return null;
  }
}

/** Clean product title: remove price prefix and size note */
function cleanTitle(raw) {
  return raw
    .replace(/^[¥￥\s\\~0-9]+\s*/i, '')
    .replace(/\s*（[^）]*im\s+\d+cm[^）]*）\s*$/i, '')
    .replace(/\s*\([^)]*im\s+\d+cm[^)]*\)\s*$/i, '')
    .trim() || 'Product';
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'product';
}

// ─── Progress tracking ───────────────────────────────────────────────────────

function loadProgress() {
  try {
    if (existsSync(PROGRESS_FILE)) {
      return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));
    }
  } catch { }
  return { completed: [], failed: [] };
}

function saveProgress(progress) {
  try {
    writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf8');
  } catch (e) {
    console.error('Warning: could not save progress:', e.message);
  }
}

// ─── HTTP fetchers ────────────────────────────────────────────────────────────

async function fetchWithRetryContext(url, isHtml = true, maxRetries = 3) {
  await initBrowser();
  const page = await browserContext.newPage();

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await page.goto(url, { waitUntil: isHtml ? 'domcontentloaded' : 'commit', timeout: 15000 });
      if (!response) throw new Error(`Timeout ${url}`);

      const status = response.status();
      if (status >= 400) {
        if (status === 522 || status === 429 || status >= 500) {
          throw new Error(`HTTP ${status}`);
        }
        throw new Error(`HTTP ${status} ${url}`);
      }

      // If it's HTML, wait a bit for JS to execute (Cloudflare challenge)
      if (isHtml) await page.waitForTimeout(1000);

      if (isHtml) {
        const content = await page.content();
        await page.close();
        return content;
      } else {
        const buffer = await response.body();
        await page.close();
        return buffer;
      }
    } catch (e) {
      if (i === maxRetries - 1) {
        await page.close();
        throw e;
      }
      const waitMs = 1000 * Math.pow(2, i);
      console.log(`    [Retry ${i + 1}/${maxRetries}] ${e.message} - waiting ${waitMs}ms...`);
    }
  }
}

async function fetchAlbumData(url) {
  await initBrowser();
  const page = await browserContext.newPage();

  for (let i = 0; i < 3; i++) {
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      if (!response) throw new Error(`Timeout ${url}`);

      const status = response.status();
      if (status >= 400 && status !== 522) {
        throw new Error(`HTTP ${status} ${url}`);
      }

      await page.setViewportSize({ width: 800, height: 600 });
      await page.waitForTimeout(1000);
      await page.evaluate(async () => {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(r => setTimeout(r, 1000));
        window.scrollTo(0, 0);
      });

      const html = await page.content();
      const screenshot = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 30 });
      await page.close();
      return { html, screenshotBase64: screenshot.toString('base64') };
    } catch (e) {
      if (i === 2) {
        await page.close();
        throw e;
      }
      const waitMs = 1000 * Math.pow(2, i);
      console.log(`    [Retry Album Fetch ${i + 1}/3] ${e.message} - waiting ${waitMs}ms...`);
    }
  }
}

async function fetchHtml(url, referer) {
  return await fetchWithRetryContext(url, true);
}

async function fetchImageBuffer(url, referer) {
  await initBrowser();
  const page = await browserContext.newPage();
  if (referer) {
    await page.setExtraHTTPHeaders({ 'Referer': referer });
  }

  for (let i = 0; i < 3; i++) {
    try {
      const response = await page.goto(url, { waitUntil: 'commit', timeout: 15000 });
      if (!response) throw new Error(`Timeout ${url}`);

      const status = response.status();
      if (status >= 400) {
        throw new Error(`HTTP ${status} ${url}`);
      }

      const buffer = await response.body();
      await page.close();
      return buffer;
    } catch (e) {
      if (i === 2) {
        await page.close();
        throw e;
      }
      const waitMs = 1000 * Math.pow(2, i);
      console.log(`    [Retry ${i + 1}/3] ${e.message} - waiting ${waitMs}ms...`);
      await page.waitForTimeout(waitMs);
    }
  }
}

/**
 * Download multiple images in parallel (batch of PARALLEL_DOWNLOADS).
 * Returns array of { index, buffer } for successful downloads.
 */
async function downloadImagesParallel(imageUrls, referer) {
  const results = [];
  for (let start = 0; start < imageUrls.length; start += PARALLEL_DOWNLOADS) {
    const batch = imageUrls.slice(start, start + PARALLEL_DOWNLOADS);
    const promises = batch.map(async (url, batchIdx) => {
      const index = start + batchIdx;
      try {
        const buffer = await fetchImageBuffer(url, referer);
        if (buffer.length < MIN_IMAGE_SIZE_BYTES) {
          console.log(`    Skip image ${index + 1} (too small: ${Math.round(buffer.length / 1024)} KB)`);
          return null;
        }
        return { index, buffer };
      } catch (e) {
        console.log(`    Skip image ${index + 1}: ${e.message}`);
        return null;
      }
    });
    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter(Boolean));
    if (start + PARALLEL_DOWNLOADS < imageUrls.length) await sleep(100);
  }
  return results;
}

// ─── Yupoo HTML parsers ──────────────────────────────────────────────────────

/** Get album URLs from a category page */
function parseCategoryPage(html, baseUrl, origin) {
  const links = [];
  const $ = cheerio.load(html);
  const baseOrigin = origin || (baseUrl && baseUrl.startsWith('http') ? new URL(baseUrl).origin : '');

  const nextData = $('script#__NEXT_DATA__').html();
  if (nextData) {
    try {
      const data = JSON.parse(nextData);
      const albums = data?.props?.pageProps?.albums ?? data?.props?.pageProps?.albumList ?? data?.props?.pageProps?.list ?? [];
      const items = Array.isArray(albums) ? albums : (albums?.items ?? []);
      for (const item of items) {
        const id = item.id ?? item.album_id ?? item._id;
        const link = item.link ?? item.url;
        if (id) {
          const href = link && link.startsWith('http') ? link : `${baseOrigin}/albums/${id}`;
          if (!links.includes(href)) links.push(href);
        } else if (typeof link === 'string' && link.includes('/albums/')) {
          const full = resolveUrl(link, baseUrl);
          if (!links.includes(full)) links.push(full);
        }
      }
    } catch (e) { }
  }

  if (links.length === 0) {
    $('a[href*="/albums/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        const full = resolveUrl(href, baseUrl);
        if (/\/albums\/\d+/.test(full) && !links.includes(full)) links.push(full);
      }
    });
  }
  return [...new Set(links)];
}

/** Fetch all pages of a category */
const MAX_CATEGORY_PAGES = 100;

async function fetchAllCategoryPages(categoryUrl, origin) {
  const baseUrl = categoryUrl.replace(/\?.*$/, '');
  const seen = new Set();
  const allAlbums = [];
  let page = 1;

  while (page <= MAX_CATEGORY_PAGES) {
    const pageUrl = page === 1 ? baseUrl : baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'page=' + page;
    console.log(`Fetching page ${page}: ${pageUrl}`);
    const html = await fetchHtml(pageUrl, origin || baseUrl);
    const albums = parseCategoryPage(html, pageUrl, origin || (baseUrl.startsWith('http') ? new URL(baseUrl).origin : ''));
    if (albums.length === 0) break;
    let added = 0;
    for (const u of albums) {
      if (!seen.has(u)) {
        seen.add(u);
        allAlbums.push(u);
        added++;
      }
    }
    console.log(`Page ${page}: ${albums.length} album(s), total ${allAlbums.length}`);
    if (added === 0) break;
    page++;
    if (page <= MAX_CATEGORY_PAGES) await sleep(DELAY_MS);
  }

  return allAlbums;
}

/** True if URL is a real image (not data: placeholder). */
function isRealImageUrl(url) {
  if (!url || url.startsWith('data:')) return false;
  const u = url.startsWith('//') ? 'https:' + url : url;
  return u.startsWith('http') && !u.includes('avatar') && !u.includes('logo') && !u.includes('icon');
}

/** Normalize URL for dedupe */
function normalizeImageUrl(url) {
  try {
    const u = new URL(url.startsWith('//') ? 'https:' + url : url);
    u.search = '';
    return u.href;
  } catch {
    return url;
  }
}

/** Extract high-quality image URLs from album page */
function parseAlbumPageImages(html, albumUrl) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const urls = [];
  $('img').each((_, el) => {
    const dataOrigin = $(el).attr('data-origin-src');
    const dataOriginal = $(el).attr('data-original');
    const dataSrc = $(el).attr('data-src');
    const src = $(el).attr('src');
    const candidates = [dataOrigin, dataOriginal, src, dataSrc].filter(Boolean);
    let chosen = null;
    for (const c of candidates) {
      if (!isRealImageUrl(c)) continue;
      const full = c.startsWith('//') ? 'https:' + c : resolveUrl(c, albumUrl);
      chosen = full;
      break;
    }
    if (chosen) {
      const norm = normalizeImageUrl(chosen);
      if (!seen.has(norm)) {
        seen.add(norm);
        urls.push(chosen);
      }
    }
  });
  return urls;
}

/** Get product title from album page */
function parseAlbumTitle(html) {
  const $ = cheerio.load(html);
  const title = $('title').text() || $('h1').first().text() || $('meta[property="og:title"]').attr('content') || '';
  return cleanTitle(title.trim()) || 'Product';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  loadEnvLocal();

  const args = process.argv.slice(2).filter((a) => !a.startsWith('--env-file'));
  let url = args.find((a) => a.startsWith('http'));
  let fromNum = null;
  let toNum = null;
  let maxProducts = DEFAULT_MAX_PRODUCTS;
  let brandSlug = null;
  let categorySlug = null;
  let styleSlug = null;
  let useAi = false;
  let autoPublish = false;
  let resumeMode = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) { fromNum = parseInt(args[i + 1], 10); i++; }
    else if (args[i] === '--to' && args[i + 1]) { toNum = parseInt(args[i + 1], 10); i++; }
    else if (args[i] === '--max' && args[i + 1]) { maxProducts = parseInt(args[i + 1], 10) || DEFAULT_MAX_PRODUCTS; i++; }
    else if (args[i] === '--brand' && args[i + 1]) { brandSlug = args[i + 1].trim(); i++; }
    else if (args[i] === '--category' && args[i + 1]) { categorySlug = args[i + 1].trim(); i++; }
    else if (args[i] === '--style' && args[i + 1]) { styleSlug = args[i + 1].trim(); i++; }
    else if (args[i] === '--ai') { useAi = true; }
    else if (args[i] === '--publish') { autoPublish = true; }
    else if (args[i] === '--resume') { resumeMode = true; }
  }

  if (!url) {
    console.error('Usage: node --env-file=.env.local scripts/import-yupoo-to-sanity.mjs <url> [--from N --to M] [--max N] [--brand SLUG] [--category SLUG] [--style SLUG] [--ai] [--publish] [--resume]');
    process.exit(1);
  }

  let origin;
  try { origin = new URL(url).origin; } catch (e) { console.error('Invalid URL:', url); process.exit(1); }

  const isSingleAlbum = /\/albums\/\d+/.test(url.replace(/\?.*$/, ''));
  const isCategory = url.includes('/categories/');
  const isAlbumsIndex = url.includes('.yupoo.com') && !isCategory && !isSingleAlbum &&
    (url === origin + '/' || url === origin || url.replace(/\?.*$/, '').endsWith('/albums') || url.replace(/\?.*$/, '').endsWith('/albums/'));

  if (!isCategory && !isSingleAlbum && !isAlbumsIndex) {
    console.error('URL must be: Yupoo category (/categories/...), single album (/albums/123), or site root');
    process.exit(1);
  }

  // Resolve range
  let rangeFrom = 1;
  let rangeTo = maxProducts;
  if (fromNum != null && toNum != null) {
    rangeFrom = Math.max(1, fromNum);
    rangeTo = Math.max(rangeFrom, toNum);
  } else if (fromNum != null || toNum != null) {
    console.error('Use both --from N and --to M together.');
    process.exit(1);
  }

  // ── Sanity client ────────────────────────────────────────────────────────
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
  const token = (process.env.SANITY_API_TOKEN || '').replace(/\r\n?|\n/g, '').trim();
  if (!projectId || !token) { console.error('Set NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_TOKEN in .env.local'); process.exit(1); }

  const client = createClient({ projectId, dataset, apiVersion: '2024-01-01', useCdn: false, token });

  try {
    await client.fetch('*[_type == "product"][0]{_id}');
  } catch (e) {
    console.error('Sanity token check failed:', e.message);
    process.exit(1);
  }

  // ── Fetch existing sourceUrls for deduplication ──────────────────────────
  console.log('Checking for existing products (deduplication)...');
  const existingSourceUrls = new Set();
  try {
    const existing = await client.fetch('*[_type == "product" && defined(sourceUrl)]{sourceUrl}');
    for (const p of existing || []) {
      if (p.sourceUrl) existingSourceUrls.add(p.sourceUrl.replace(/\?.*$/, ''));
    }
    console.log(`Found ${existingSourceUrls.size} existing product(s) in Sanity.`);
  } catch (e) {
    console.warn('Could not fetch existing products for dedup:', e.message);
  }

  // ── Resolve brand/category/style references ──────────────────────────────
  const brandSlugToUse = brandSlug || 'broken-planet';
  const styleSlugToUse = styleSlug;

  let brandRef, categoryRef, styleRef;
  try {
    const [brand, category, style] = await Promise.all([
      client.fetch('*[_type == "brand" && slug.current == $slug][0]{_id, title, "slug": slug.current}', { slug: brandSlugToUse }),
      categorySlug
        ? client.fetch('*[_type == "category" && slug.current == $slug][0]{_id, title, "slug": slug.current}', { slug: categorySlug })
        : Promise.resolve(null),
      styleSlugToUse
        ? client.fetch('*[_type == "style" && slug.current == $slug][0]{_id, title, "slug": slug.current}', { slug: styleSlugToUse })
        : Promise.resolve(null),
    ]);
    brandRef = brand;
    categoryRef = category;
    styleRef = style;
  } catch (e) {
    console.error('Failed to fetch brand/category/style:', e.message);
  }
  if (!brandRef) console.warn(`Brand "${brandSlugToUse}" not found in Sanity.`);
  if (categorySlug && !categoryRef) console.warn(`Category "${categorySlug}" not found.`);
  if (styleSlugToUse && !styleRef) console.warn(`Style "${styleSlugToUse}" not found.`);

  // ── AI context: examples + metadata ──────────────────────────────────────
  let aiContext = null;
  if (useAi) {
    const keysEnv = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    const apiKeys = keysEnv.split(',').map((k) => k.replace(/\r\n?|\n/g, '').trim()).filter(Boolean);
    if (apiKeys.length === 0) {
      console.warn('--ai requested but GEMINI_API_KEY not set. Proceeding without AI.');
      useAi = false;
    } else {
      try {
        const [categoriesList, stylesList, brandsList, examples] = await Promise.all([
          client.fetch('*[_type == "category" && !(_id in path("drafts.**"))]{ _id, title, "slug": slug.current }'),
          client.fetch('*[_type == "style" && !(_id in path("drafts.**"))]{ _id, title, "slug": slug.current }'),
          client.fetch('*[_type == "brand" && !(_id in path("drafts.**"))]{ _id, title, "slug": slug.current }'),
          // Fetch 5 best examples: published products with descriptions
          client.fetch(
            `*[_type == "product" && !(_id in path("drafts.**")) && defined(description) && description != ""][0...5]{
              title, description, subtype, price,
              "categorySlug": category->slug.current,
              "styleSlug": style->slug.current,
              "brandSlug": brand->slug.current,
              colors
            }`
          ),
        ]);
        aiContext = {
          apiKeys,
          categories: categoriesList || [],
          styles: stylesList || [],
          brands: brandsList || [],
          exampleProducts: examples || [],
        };
        console.log(`AI context: ${aiContext.categories.length} categories, ${aiContext.styles.length} styles, ${aiContext.brands.length} brands, ${aiContext.exampleProducts.length} example products`);
      } catch (e) {
        console.warn('Failed to load AI context:', e.message);
        useAi = false;
      }
    }
  }

  // ── Fetch album URLs ─────────────────────────────────────────────────────
  let albumUrls = [];
  const fetchBaseUrl = isCategory ? url : isAlbumsIndex ? origin + '/albums/' : null;

  if (isCategory || isAlbumsIndex) {
    const label = isCategory ? 'category' : 'albums index';
    console.log(`\nFetching ${label} (all pages)...`, fetchBaseUrl);
    const allAlbums = await fetchAllCategoryPages(fetchBaseUrl, origin);
    console.log(`Found ${allAlbums.length} album(s) total. Importing range: ${rangeFrom}–${rangeTo}`);
    albumUrls = allAlbums.slice(rangeFrom - 1, rangeTo);
    if (albumUrls.length === 0) {
      console.error('No albums in range.');
      process.exit(1);
    }
    await sleep(DELAY_MS);
  } else if (isSingleAlbum) {
    albumUrls = [url];
    rangeFrom = 1;
    rangeTo = 1;
  }

  // ── Resume: filter out already completed ─────────────────────────────────
  const progress = resumeMode ? loadProgress() : { completed: [], failed: [] };
  if (resumeMode && progress.completed.length > 0) {
    const before = albumUrls.length;
    albumUrls = albumUrls.filter((u) => !progress.completed.includes(u.replace(/\?.*$/, '')));
    console.log(`Resume mode: skipping ${before - albumUrls.length} already completed albums.`);
  }

  // ── Deduplication: filter out existing products ──────────────────────────
  if (existingSourceUrls.size > 0) {
    const before = albumUrls.length;
    albumUrls = albumUrls.filter((u) => !existingSourceUrls.has(u.replace(/\?.*$/, '')));
    const skipped = before - albumUrls.length;
    if (skipped > 0) console.log(`Dedup: skipping ${skipped} albums already in Sanity.`);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Albums to import: ${albumUrls.length}` + (useAi ? ' (with AI enrichment)' : '') + (autoPublish ? ' [AUTO-PUBLISH]' : ' [DRAFTS]'));
  console.log('═'.repeat(60));

  // ── Slug base ────────────────────────────────────────────────────────────
  const categorySlugSafe = categorySlug || 'product';
  const styleSlugSafe = styleSlug || 'style';
  const brandSlugSafe = brandSlugToUse || 'brand';
  const slugBase = [categorySlugSafe, styleSlugSafe, brandSlugSafe].join('_');

  let created = 0;
  let failed = 0;
  let skipped = 0;
  const startTime = Date.now();

  for (let i = 0; i < albumUrls.length; i++) {
    const albumUrl = albumUrls[i];
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const eta = i > 0 ? Math.round(((Date.now() - startTime) / i) * (albumUrls.length - i) / 1000) : '?';
    console.log(`\n[${i + 1}/${albumUrls.length}] (${elapsed}s elapsed, ~${eta}s remaining) ${albumUrl}`);

    try {
      const albumOrigin = new URL(albumUrl).origin;
      let html = '';
      let albumScreenshotBase64 = null;
      if (useAi) {
        console.log(`  📸 Capturing album screenshot for AI context...`);
        try {
          const data = await fetchAlbumData(albumUrl);
          html = data.html;
          albumScreenshotBase64 = data.screenshotBase64;
          console.log(`    ✅ Screenshot captured.`);
        } catch (e) {
          console.log(`    ⚠ Screenshot failed: ${e.message}. Falling back.`);
          html = await fetchHtml(albumUrl, albumOrigin);
        }
      } else {
        html = await fetchHtml(albumUrl, albumOrigin);
      }
      await sleep(DELAY_MS);

      const imageUrls = parseAlbumPageImages(html, albumUrl);
      if (imageUrls.length === 0) {
        console.log('  ⚠ No images found. Skip.');
        failed++;
        continue;
      }
      console.log(`  📸 Images: ${imageUrls.length}`);

      const title = parseAlbumTitle(html);
      const priceYuan = parsePriceFromTitle(html) || parsePriceFromTitle(title);
      const rawTitle = getRawAlbumTitle(html);
      const isSale = isDiscountFromTitle(rawTitle);
      if (isSale) console.log('  💸 Sale detected from title');
      const albumIdMatch = albumUrl.match(/\/albums\/(\d+)/);
      const slug = albumIdMatch && albumUrls.length === 1
        ? slugBase + '_' + albumIdMatch[1]
        : slugBase + '_' + (rangeFrom + i);

      // ── Download ALL images in parallel ────────────────────────────────
      const downloadedImages = await downloadImagesParallel(imageUrls, albumOrigin);
      if (downloadedImages.length === 0) {
        console.log('  ⚠ No valid images downloaded. Skip.');
        failed++;
        continue;
      }
      console.log(`  ✅ Downloaded: ${downloadedImages.length} valid images`);

      // ── AI enrichment (multi-image) ────────────────────────────────────
      let aiResult = null;
      if (useAi && aiContext) {
        try {
          // Send the full album screenshot first (contains weight, prices, context),
          // followed by up to 3 individual high-res photos.
          const aiImages = [
            albumScreenshotBase64,
            ...downloadedImages.slice(0, Math.max(0, MAX_AI_IMAGES - 1)).map((d) => d.buffer.toString('base64'))
          ].filter(Boolean);

          const brandTitle = aiContext.brands.find((b) => (b.slug || b.slug?.current) === brandSlugToUse)?.title || brandSlugToUse;

          aiResult = await callGeminiForProduct({
            imagesBase64: aiImages,
            title,
            priceYuan: priceYuan ?? undefined,
            brandName: brandTitle,
            categories: aiContext.categories,
            styles: aiContext.styles,
            brands: aiContext.brands,
            exampleProducts: aiContext.exampleProducts,
            apiKeys: aiContext.apiKeys,
          });

          if (aiResult) {
            console.log(`  🤖 AI: "${aiResult.title?.slice(0, 50)}..." | ${aiResult.priceUzs} UZS | ${aiResult.subtype} | ${aiResult.colors?.join(', ')}`);
          } else {
            console.log('  ⚠ AI returned no result. Using fallback data.');
          }
          await sleep(AI_DELAY_MS);
        } catch (e) {
          console.log(`  ⚠ AI error: ${e.message}`);
        }
      }

      // ── Upload images to Sanity ────────────────────────────────────────
      console.log('  📤 Uploading images to Sanity...');
      const imageRefs = [];
      for (const { index, buffer } of downloadedImages) {
        try {
          await sleep(100);
          const asset = await client.assets.upload('image', buffer, {
            filename: `yupoo-${i}-${index}.jpg`,
            contentType: 'image/jpeg',
          });
          imageRefs.push({
            _key: `img-${i}-${index}-${asset._id.slice(-6)}`,
            _type: 'image',
            asset: { _type: 'reference', _ref: asset._id },
          });
        } catch (e) {
          console.log(`    Upload error image ${index + 1}: ${e.message}`);
        }
      }

      if (imageRefs.length === 0) {
        console.log('  ⚠ No images uploaded. Skip.');
        failed++;
        continue;
      }

      // ── Build product document ─────────────────────────────────────────
      let docTitle = title.slice(0, 90);
      let docPrice = roundPriceToNiceUzs(priceYuan ? Math.round(priceYuan * YUAN_TO_UZS) : DEFAULT_PRICE_UZS);
      let docDescription = undefined;
      let docSubtype = undefined;
      let docInternalNotes = undefined;
      let docCategoryRef = categoryRef;
      let docStyleRef = styleRef;
      let docBrandRef = brandRef;
      let docColors = ['Black'];

      if (aiResult) {
        if (aiResult.title) docTitle = String(aiResult.title).slice(0, 90);
        if (aiResult.description) docDescription = String(aiResult.description);
        if (aiResult.internalNotes) docInternalNotes = String(aiResult.internalNotes);
        if (aiResult.subtype) docSubtype = String(aiResult.subtype);
        if (Array.isArray(aiResult.colors) && aiResult.colors.length > 0) docColors = aiResult.colors.map(String);
        if (aiResult.priceUzs != null && Number.isFinite(Number(aiResult.priceUzs))) {
          docPrice = roundPriceToNiceUzs(Math.round(Number(aiResult.priceUzs)));
        } else if (priceYuan != null) {
          docPrice = calculatePriceUzs(priceYuan, guessWeightKg(title, docSubtype));
        }
        // AI can override category (but NOT brand/style — those come from CLI args)
        if (aiResult.categorySlug && aiContext?.categories) {
          const cat = aiContext.categories.find((c) => (c.slug || c.slug?.current) === aiResult.categorySlug);
          if (cat?._id) docCategoryRef = cat;
        }
      }

      const productId = autoPublish
        ? 'product-' + String(slug).replace(/[^a-zA-Z0-9_-]/g, '-')
        : 'drafts.product-' + String(slug).replace(/[^a-zA-Z0-9_-]/g, '-');

      const doc = {
        _id: productId,
        _type: 'product',
        title: docTitle,
        slug: { _type: 'slug', current: slug },
        price: docPrice,
        images: imageRefs,
        sizes: ['S', 'M', 'L', 'XL'],
        colors: docColors,
        isHotDrop: false,
        isOnSale: isSale,
        sourceUrl: albumUrl || undefined,
      };
      if (docDescription != null) doc.description = docDescription;
      if (docInternalNotes != null) doc.internalNotes = docInternalNotes;
      if (docSubtype != null) doc.subtype = normalizeSubtype(docSubtype);
      if (docBrandRef?._id) doc.brand = { _type: 'reference', _ref: docBrandRef._id };
      if (docCategoryRef?._id) doc.category = { _type: 'reference', _ref: docCategoryRef._id };
      if (docStyleRef?._id) doc.style = { _type: 'reference', _ref: docStyleRef._id };

      if (isSale && docPrice != null) {
        const typicalUzs = await getTypicalPriceForBrandSubtype(client, docBrandRef?._id, docSubtype ?? undefined);
        if (typicalUzs != null && typicalUzs > docPrice) {
          doc.originalPrice = roundPriceToNiceUzs(typicalUzs);
          console.log(`  📌 originalPrice from catalog (brand+subtype median): ${doc.originalPrice.toLocaleString()} UZS`);
        }
      }

      await client.createOrReplace(doc);
      created++;

      // Track progress
      progress.completed.push(albumUrl.replace(/\?.*$/, ''));
      if (i % 5 === 0) saveProgress(progress); // save every 5 products

      const status = autoPublish ? '🟢 Published' : '📝 Draft';
      console.log(`  ${status}: ${slug} — "${docTitle.slice(0, 40)}..." — ${docPrice.toLocaleString()} UZS`);

    } catch (e) {
      console.error(`  ❌ Error: ${e.message}`);
      failed++;
      progress.failed.push(albumUrl);
    }

    await sleep(DELAY_MS);
  }

  // Final progress save
  saveProgress(progress);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Done in ${totalTime}s.`);
  console.log(`  ✅ Created: ${created}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  ⏭  Skipped (dedup): ${skipped}`);
  console.log('═'.repeat(60));
  if (created > 0 && !autoPublish) {
    console.log('Tip: Products are drafts. Publish them in Sanity Studio, or re-run with --publish.');
  }

  await closeBrowser();
}

main().catch(async (e) => {
  console.error(e);
  await closeBrowser();
  process.exit(1);
});
