#!/usr/bin/env node
/**
 * Import products from a Yupoo category or album V3 (Enterprise Edition).
 *
 * Features:
 *   - Concurrency (Promise Pool) for parallel album processing
 *   - Telegram bot integration for progress monitoring and error reporting
 *   - Anti-Ban protection: Browser rotation, random delays (jitter)
 *   - Max 3 concurrent scraping ops, but uploads/compressions are unblocked
 *   - Multi-image AI (Gemini) with round-robin key management
 *   - Progress saving to resume later
 *
 * Usage:
 *   node --env-file=.env.local scripts/import-yupoo-to-sanity.mjs <url> [options]
 *
 * Options:
 *   --concurrency N   Number of parallel album downloads (default: 3)
 *   --from N --to M   Import albums from position N to M.
 *   --max N           Alternative: max products.
 *   --brand SLUG
 *   --category SLUG
 *   --style SLUG
 *   --tier TIER
 *   --ai              Enable Gemini AI enrichment
 *   --publish         Publish immediately
 *   --resume          Resume from last progress
 */
import { createClient } from '@sanity/client';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';

import {
  callGeminiForProduct,
  calculatePriceUzs,
  guessWeightKg,
  roundPriceToNiceUzs,
  normalizeSubtype,
} from './lib/gemini-enrich.mjs';
import { compressImageToMaxBytes } from './lib/compress-image.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const PROGRESS_FILE = join(PROJECT_ROOT, '.yupoo-progress.json');

// --- Telegram Config ---
let tgBotToken = '';
let tgChatId = '';

async function sendTelegramMessage(text) {
  if (!tgBotToken || !tgChatId) return;
  try {
    const url = `https://api.telegram.org/bot${tgBotToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tgChatId, text, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.warn('Failed to send Telegram message:', e.message);
  }
}

// --- Browser Rotation & Anti-Ban ---
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

let browser = null;
let browserContext = null;
let browserUseCount = 0;
const BROWSER_MAX_USES = 80;

async function initBrowser() {
  if (browser && browserUseCount < BROWSER_MAX_USES) return;
  
  if (browser) {
      console.log(`[Browser] Reached ${BROWSER_MAX_USES} limit, rotating...`);
      await browser.close();
  }
  
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  browser = await chromium.launch({ headless: true });
  browserContext = await browser.newContext({
    userAgent: ua,
    extraHTTPHeaders: {
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    }
  });
  browserUseCount = 0;
}

async function getPage() {
  await initBrowser();
  browserUseCount++;
  return await browserContext.newPage();
}

async function closeBrowser() {
  if (browser) await browser.close();
  browser = null;
}

// --- Utils ---
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function jitterStr(min = 1000, max = 3000) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

const DEFAULT_PRICE_UZS = 200_000;
const YUAN_TO_UZS = 1_600;
let MIN_IMAGE_SIZE_BYTES = 200 * 1024;
const MAX_AI_IMAGES = 10;
const PARALLEL_DOWNLOADS = 5;
const PARALLEL_UPLOADS = 5;
const MAX_UPLOAD_BYTES = 250 * 1024;
const MAX_SLUG_TITLE_LENGTH = 40;

function resolveUrl(url, base) {
  try { return new URL(url, base).href; } catch { return url; }
}

function normalizeImageUrl(url) {
  try {
    const u = new URL(url.startsWith('//') ? 'https:' + url : url);
    u.search = '';
    return u.href;
  } catch {
    return url;
  }
}

function isRealImageUrl(url) {
  if (!url || url.startsWith('data:')) return false;
  const u = url.startsWith('//') ? 'https:' + url : url;
  return u.startsWith('http') && !u.includes('avatar') && !u.includes('logo') && !u.includes('icon');
}

function cleanTitle(raw) {
  return raw
    .replace(/^[¥￥\s\\~0-9]+\s*/i, '')
    .replace(/\s*（[^）]*im\s+\d+cm[^）]*）\s*$/i, '')
    .replace(/\s*\([^)]*im\s+\d+cm[^)]*\)\s*$/i, '')
    .trim() || 'Product';
}

function slugify(text, fallback = 'product') {
  if (!text || typeof text !== 'string') return fallback;
  const s = text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_SLUG_TITLE_LENGTH);
  return s || fallback;
}

function parsePriceFromTitle(title) {
  if (!title || typeof title !== 'string') return null;
  const m = title.match(/[¥￥]\s*\\?~?\s*(\d+)/);
  if (m) return parseInt(m[1], 10);
  const mP = title.match(/\bP\s*(\d+)\b/);
  if (mP) return parseInt(mP[1], 10);
  return null;
}

function getRawAlbumTitle(html) {
  const $ = cheerio.load(html);
  return ($('title').text() || $('meta[property="og:title"]').attr('content') || '').trim();
}

function isDiscountFromTitle(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.toLowerCase();
  const patterns = [/discount/i, /\d+%\s*off/i, /off\s*discount/i, /super\s*discount/i, /【[^】]*discount[^】]*】/i, /\bsale\b/i, /скидк/i, /特价/, /折扣/, /%\s*off\s*discount/i];
  return patterns.some((p) => p.test(t));
}

function median(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

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
  } catch { return null; }
}

// --- Network ---
async function fetchWithRetryContext(url, isHtml = true, maxRetries = 3) {
  const page = await getPage();

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await page.goto(url, { waitUntil: isHtml ? 'domcontentloaded' : 'commit', timeout: 20000 });
      if (!response) throw new Error(`Timeout ${url}`);

      const status = response.status();
      if (status >= 400) {
        if (status === 522 || status === 429) throw new Error(`HTTP ${status} Cloudflare Ban/RateLimit`);
        throw new Error(`HTTP ${status}`);
      }

      if (isHtml) await page.waitForTimeout(jitterStr(500, 1500));

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
      const waitMs = jitterStr(2000 * Math.pow(2, i), 4000 * Math.pow(2, i));
      console.log(`    [Retry ${i + 1}/${maxRetries}] ${e.message} - waiting ${Math.round(waitMs/1000)}s...`);
      await sleep(waitMs);
    }
  }
}

async function fetchAlbumData(url) {
  const page = await getPage();

  for (let i = 0; i < 3; i++) {
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      if (!response) throw new Error(`Timeout ${url}`);

      const status = response.status();
      if (status >= 400) throw new Error(`HTTP ${status}`);

      await page.setViewportSize({ width: 800, height: 600 });
      await page.waitForTimeout(jitterStr(800, 1500));
      await page.evaluate(async () => {
        window.scrollTo(0, document.body.scrollHeight / 2);
        await new Promise(r => setTimeout(r, 600));
        window.scrollTo(0, document.body.scrollHeight);
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
      const waitMs = jitterStr(2000, 5000);
      console.log(`    [Retry Album Fetch] waiting ${Math.round(waitMs/1000)}s...`);
      await sleep(waitMs);
    }
  }
}

async function fetchHtml(url, referer) {
  return await fetchWithRetryContext(url, true);
}

async function fetchImageBuffer(url, referer) {
  const page = await getPage();
  if (referer) await page.setExtraHTTPHeaders({ 'Referer': referer });

  for (let i = 0; i < 3; i++) {
    try {
      const response = await page.goto(url, { waitUntil: 'commit', timeout: 15000 });
      if (!response) throw new Error(`Timeout`);
      const status = response.status();
      if (status >= 400) throw new Error(`HTTP ${status}`);
      const buffer = await response.body();
      await page.close();
      return buffer;
    } catch (e) {
      if (i === 2) {
        await page.close();
        throw e;
      }
      const w = jitterStr(1000, 3000);
      await sleep(w);
    }
  }
}

async function downloadImagesParallel(imageUrls, referer, minSizeBytes = MIN_IMAGE_SIZE_BYTES) {
  const results = [];
  for (let start = 0; start < imageUrls.length; start += PARALLEL_DOWNLOADS) {
    const batch = imageUrls.slice(start, start + PARALLEL_DOWNLOADS);
    const promises = batch.map(async (url, batchIdx) => {
      const index = start + batchIdx;
      try {
        const buffer = await fetchImageBuffer(url, referer);
        if (buffer.length < minSizeBytes) return null;
        return { index, buffer };
      } catch (e) { return null; }
    });
    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter(Boolean));
    if (start + PARALLEL_DOWNLOADS < imageUrls.length) await sleep(50);
  }
  results.sort((a, b) => a.index - b.index);
  return results;
}

// --- Parsers ---
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

async function fetchAllCategoryPages(categoryUrl, origin) {
  const baseUrl = categoryUrl.replace(/\?.*$/, '');
  const seen = new Set();
  const allAlbums = [];
  let page = 1;
  while (page <= 100) {
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
    if (added === 0) break;
    page++;
    await sleep(200);
  }
  return allAlbums;
}

function parseAlbumPageImages(html, albumUrl) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const urls = [];

  // Rely on document order for images, don't prioritize og:image
  // as it may not be the intended first photo in the gallery.

  $('img').each((_, el) => {
    const candidates = [$(el).attr('data-origin-src'), $(el).attr('data-original'), $(el).attr('src'), $(el).attr('data-src')].filter(Boolean);
    for (const c of candidates) {
      if (!isRealImageUrl(c)) continue;
      const full = c.startsWith('//') ? 'https:' + c : resolveUrl(c, albumUrl);
      const norm = normalizeImageUrl(full);
      if (!seen.has(norm)) {
        seen.add(norm);
        urls.push(full);
      }
      break;
    }
  });
  return urls;
}

function parseAlbumTitle(html) {
  const $ = cheerio.load(html);
  const title = $('title').text() || $('h1').first().text() || $('meta[property="og:title"]').attr('content') || '';
  return cleanTitle(title.trim()) || 'Product';
}

function loadProgress() {
  try { if (existsSync(PROGRESS_FILE)) return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8')); } catch { }
  return { completed: [], failed: [] };
}

function saveProgress(progress) {
  try { writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf8'); } catch (e) {}
}

async function asyncPool(items, concurrency, iteratorFn) {
  const results = [];
  const executing = new Set();
  
  for (const item of items) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    results.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean).catch(clean);
    if (executing.size >= concurrency) await Promise.race(executing);
  }
  return Promise.all(results);
}


// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  try {
    const cont = readFileSync(join(PROJECT_ROOT, '.env.local'), 'utf8');
    cont.split('\n').filter(l => l.trim() && !l.startsWith('#')).forEach(l => {
      const eq = l.indexOf('=');
      if (eq > 0) process.env[l.slice(0, eq).trim()] = l.slice(eq+1).replace(/["']/g, '').trim();
    });
  } catch(e) {}

  tgBotToken = process.env.ADMIN_BOT_TOKEN || process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
  tgChatId = (process.env.ADMIN_TELEGRAM_IDS || '').split(',')[0].trim() || process.env.TELEGRAM_CHAT_ID || '';

  const args = process.argv.slice(2);
  let url = args.find((a) => a.startsWith('http'));
  let maxProducts = 1000; // Increased default
  let concurrency = 3;
  let brandSlug = null;
  let categorySlug = null;
  let styleSlug = null;
  let useAi = false;
  let autoPublish = false;
  let resumeMode = false;
  let tierValue = 'ultimate';
  let fromIdx = 1;
  let toIdx = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max' && args[i + 1]) { maxProducts = parseInt(args[i + 1], 10); i++; }
    else if (args[i] === '--concurrency' && args[i + 1]) { concurrency = parseInt(args[i + 1], 10); i++; }
    else if (args[i] === '--brand' && args[i + 1]) { brandSlug = args[i + 1].trim(); i++; }
    else if (args[i] === '--category' && args[i + 1]) { categorySlug = args[i + 1].trim(); i++; }
    else if (args[i] === '--style' && args[i + 1]) { styleSlug = args[i + 1].trim(); i++; }
    else if (args[i] === '--tier' && args[i + 1]) { tierValue = args[i + 1].trim().toLowerCase(); i++; }
    else if (args[i] === '--from' && args[i + 1]) { fromIdx = parseInt(args[i + 1], 10); i++; }
    else if (args[i] === '--to' && args[i + 1]) { toIdx = parseInt(args[i + 1], 10); i++; }
    else if (args[i] === '--min-image-size' && args[i + 1]) { 
      const kb = parseInt(args[i + 1], 10);
      if (!isNaN(kb)) MIN_IMAGE_SIZE_BYTES = kb * 1024;
      i++; 
    }
    else if (args[i] === '--ai') { useAi = true; }
    else if (args[i] === '--publish') { autoPublish = true; }
    else if (args[i] === '--resume') { resumeMode = true; }
  }

  if (!url) {
    console.error('Usage: node scripts/import-yupoo-to-sanity.mjs <url> [--max N] [--concurrency N] [--brand SLUG] [--category SLUG] [--style SLUG] [--ai] [--publish] [--resume]');
    process.exit(1);
  }

  const origin = new URL(url).origin;
  const isSingleAlbum = /\/albums\/\d+/.test(url.replace(/\?.*$/, ''));
  const isCategory = url.includes('/categories/');
  const isAlbumsIndex = url.includes('.yupoo.com') && !isCategory && !isSingleAlbum && (url === origin + '/' || url === origin || url.replace(/\?.*$/, '').endsWith('/albums/'));

  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
  const token = (process.env.SANITY_API_TOKEN || '').trim();
  if (!projectId || !token) { console.error('Set NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_TOKEN'); process.exit(1); }

  const client = createClient({ projectId, dataset, apiVersion: '2024-01-01', useCdn: false, token });
  try { await client.fetch('*[_type == "product"][0]{_id}'); } catch (e) { console.error('Sanity check failed:', e.message); process.exit(1); }

  const existingSourceUrls = new Set();
  try {
    const existing = await client.fetch('*[_type == "product" && defined(sourceUrl)]{sourceUrl}');
    for (const p of existing || []) if (p.sourceUrl) existingSourceUrls.add(p.sourceUrl.replace(/\?.*$/, ''));
  } catch (e) {}

  const brandSlugToUse = brandSlug || 'broken-planet';
  let brandRef, categoryRef, styleRef;
  try {
    const [b, c, s] = await Promise.all([
      client.fetch('*[_type == "brand" && slug.current == $slug][0]{_id, title, "slug": slug.current}', { slug: brandSlugToUse }),
      categorySlug ? client.fetch('*[_type == "category" && slug.current == $slug][0]{_id}', { slug: categorySlug }) : null,
      styleSlug ? client.fetch('*[_type == "style" && slug.current == $slug][0]{_id}', { slug: styleSlug }) : null,
    ]);
    brandRef = b; categoryRef = c; styleRef = s;
  } catch (e) {}

  let aiContext = null;
  if (useAi) {
    const keysEnv = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    const apiKeys = keysEnv.split(',').map(k => k.trim()).filter(Boolean);
    if (apiKeys.length) {
      const [cats, styles, brands, ex] = await Promise.all([
        client.fetch('*[_type == "category"]{ _id, title, "slug": slug.current }'),
        client.fetch('*[_type == "style"]{ _id, title, "slug": slug.current }'),
        client.fetch('*[_type == "brand"]{ _id, title, "slug": slug.current }'),
        client.fetch(`*[_type == "product" && defined(description)][0...5]{title, description, price, "categorySlug": category->slug.current, "styleSlug": style->slug.current, "brandSlug": brand->slug.current, colors}`)
      ]);
      aiContext = { apiKeys, categories: cats||[], styles: styles||[], brands: brands||[], exampleProducts: ex||[] };
    } else {
      useAi = false;
    }
  }

  let albumUrls = [];
  if (isSingleAlbum) albumUrls = [url];
  else {
    const fetchBaseUrl = isCategory ? url : origin + '/albums/';
    console.log(`Fetching ${isCategory?'category':'albums index'}...`);
    albumUrls = await fetchAllCategoryPages(fetchBaseUrl, origin);
  }

  const progress = resumeMode ? loadProgress() : { completed: [], failed: [] };
  if (resumeMode) albumUrls = albumUrls.filter(u => !progress.completed.includes(u.replace(/\?.*$/, '')));
  if (existingSourceUrls.size > 0) albumUrls = albumUrls.filter(u => !existingSourceUrls.has(u.replace(/\?.*$/, '')));

  // Apply range --from and --to (1-based indices as expected by human)
  const start = Math.max(0, fromIdx - 1);
  const end = toIdx ? Math.min(albumUrls.length, toIdx) : albumUrls.length;
  albumUrls = albumUrls.slice(start, end);

  // Apply --max limit if specified
  if (args.includes('--max')) {
    albumUrls = albumUrls.slice(0, maxProducts);
  }
  
  if (albumUrls.length === 0) {
    console.log("No albums to import after dedup and max limit.");
    return;
  }

  await sendTelegramMessage(`🚀 <b>Yupoo Import Started</b>\nURL: ${url}\nTarget: ${albumUrls.length} albums\nConcurrency: ${concurrency}\nMode: ${useAi ? 'AI' : 'Standard'}`);
  console.log(`\nImporting ${albumUrls.length} albums with concurrency ${concurrency}...`);

  const slugBase = [categorySlug||'product', styleSlug||'style', brandSlugToUse].join('_');
  const stats = { success: 0, failed: 0 };
  const startTime = Date.now();

  const processAlbum = async (albumUrl) => {
    if (progress.completed.includes(albumUrl)) return;
    await sleep(jitterStr(500, 3000));
    
    try {
      const albumOrigin = new URL(albumUrl).origin;
      let html = '', albumScreenshotBase64 = null;
      
      if (useAi) {
        const data = await fetchAlbumData(albumUrl);
        if(data) { html = data.html; albumScreenshotBase64 = data.screenshotBase64; }
        else html = await fetchHtml(albumUrl, albumOrigin);
      } else {
        html = await fetchHtml(albumUrl, albumOrigin);
      }

      const imageUrls = parseAlbumPageImages(html, albumUrl);
      if (imageUrls.length === 0) throw new Error("No images found");

      const title = parseAlbumTitle(html);
      const priceYuan = parsePriceFromTitle(title) || parsePriceFromTitle(getRawAlbumTitle(html));
      const isSale = isDiscountFromTitle(getRawAlbumTitle(html));
      const albumIdMatch = albumUrl.match(/\/albums\/(\d+)/);

      const downloadedImages = await downloadImagesParallel(imageUrls, albumOrigin, MIN_IMAGE_SIZE_BYTES);
      if (downloadedImages.length === 0) throw new Error("No valid images downloaded");

      let aiResult = null;
      if (useAi && aiContext) {
        try {
          const aiImages = [albumScreenshotBase64, ...downloadedImages.slice(0, MAX_AI_IMAGES-1).map(d => d.buffer.toString('base64'))].filter(Boolean);
          const brandTitle = aiContext.brands.find(b => b.slug === brandSlugToUse)?.title || brandSlugToUse;
          aiResult = await callGeminiForProduct({
            imagesBase64: aiImages, title, priceYuan, brandName: brandTitle,
            categories: aiContext.categories, styles: aiContext.styles,
            brands: aiContext.brands, exampleProducts: aiContext.exampleProducts,
            apiKeys: aiContext.apiKeys,
          });
        } catch(e) {}
      }

      if (aiResult && aiResult.excludeImageIndices && Array.isArray(aiResult.excludeImageIndices)) {
        // excludeImageIndices refers to aiImages. 
        // aiImages[0] is albumScreenshotBase64 (if present).
        // aiImages[1..N] are downloadedImages[0..N-1].
        const offset = albumScreenshotBase64 ? 1 : 0;
        const toRemove = new Set();
        for (const idx of aiResult.excludeImageIndices) {
          const downloadedIdx = idx - offset;
          if (downloadedIdx >= 0 && downloadedIdx < downloadedImages.length) {
            toRemove.add(downloadedIdx);
          }
        }
        
        if (toRemove.size > 0) {
          const before = downloadedImages.length;
          downloadedImages = downloadedImages.filter((_, i) => !toRemove.has(i));
          console.log(`AI filtered out ${before - downloadedImages.length} unwanted images (models/charts).`);
        }
      }

      const imageRefs = [];
      for (let start = 0; start < downloadedImages.length; start += PARALLEL_UPLOADS) {
        const chunk = downloadedImages.slice(start, start + PARALLEL_UPLOADS);
        const results = await Promise.all(chunk.map(async ({ index, buffer }) => {
          try {
            const compressed = await compressImageToMaxBytes(buffer, MAX_UPLOAD_BYTES);
            const asset = await client.assets.upload('image', compressed, { filename: `yupoo-${Date.now()}-${index}.jpg` });
            return { _key: `img-${Date.now()}-${index}`, _type: 'image', asset: { _type: 'reference', _ref: asset._id } };
          } catch(e) { return null; }
        }));
        imageRefs.push(...results.filter(Boolean));
      }
      if (imageRefs.length === 0) throw new Error("No images uploaded to Sanity");

      let docTitle = title.slice(0, 90);
      let docPrice = roundPriceToNiceUzs(priceYuan ? Math.round(priceYuan * YUAN_TO_UZS) : DEFAULT_PRICE_UZS);
      let docCategoryRef = categoryRef, docStyleRef = styleRef, docBrandRef = brandRef;
      let docColors = ['Black'], docSubtype = undefined, docDesc = undefined;

      if (aiResult) {
        if (aiResult.title) docTitle = String(aiResult.title).slice(0, 90);
        if (aiResult.description) docDesc = String(aiResult.description);
        if (aiResult.subtype) docSubtype = String(aiResult.subtype);
        if (aiResult.colors?.length) docColors = aiResult.colors.map(String);
        if (aiResult.priceUzs) docPrice = Math.round(Number(aiResult.priceUzs));
        else if (priceYuan) docPrice = calculatePriceUzs(priceYuan, guessWeightKg(title, docSubtype));
        if (aiResult.categorySlug) {
          const cat = aiContext?.categories.find(c => c.slug === aiResult.categorySlug);
          if (cat) docCategoryRef = cat;
        }
      }

      const uniqueSuffix = albumIdMatch ? albumIdMatch[1] : Date.now().toString().slice(-4);
      const slug = [slugBase, slugify(docTitle), uniqueSuffix].join('_').replace(/-+/g, '-');
      const productId = autoPublish ? 'product-' + slug : 'drafts.product-' + slug;

      const doc = {
        _id: productId, _type: 'product', tier: tierValue, title: docTitle,
        slug: { _type: 'slug', current: slug }, price: docPrice,
        images: imageRefs, sizes: ['S', 'M', 'L', 'XL'], colors: docColors,
        isHotDrop: false, isOnSale: isSale, sourceUrl: albumUrl || undefined,
      };
      if (docDesc) doc.description = docDesc;
      if (docSubtype) doc.subtype = normalizeSubtype(docSubtype);
      if (docBrandRef) doc.brand = { _type: 'reference', _ref: docBrandRef._id };
      if (docCategoryRef) doc.category = { _type: 'reference', _ref: docCategoryRef._id };
      if (docStyleRef) doc.style = { _type: 'reference', _ref: docStyleRef._id };

      if (isSale) {
        const typicalUzs = await getTypicalPriceForBrandSubtype(client, docBrandRef?._id, docSubtype);
        if (typicalUzs && typicalUzs > docPrice) doc.originalPrice = roundPriceToNiceUzs(typicalUzs);
      }

      await client.createOrReplace(doc);
      
      console.log(`✅ Success: ${slug}`);
      progress.completed.push(albumUrl);
      stats.success++;

      if (stats.success % 10 === 0) {
        saveProgress(progress);
        await sendTelegramMessage(`📊 <b>Progress Update</b>\n✅ Success: ${stats.success}\n❌ Failed: ${stats.failed}\nElapsed: ${Math.round((Date.now()-startTime)/1000)}s`);
      }

    } catch (e) {
      console.log(`❌ Error: ${albumUrl} - ${e.message}`);
      progress.failed.push(albumUrl);
      stats.failed++;
    }
  };

  await asyncPool(albumUrls, concurrency, processAlbum);
  
  saveProgress(progress);
  await closeBrowser();

  const msg = `🏁 <b>Import Finished</b>\n✅ Success: ${stats.success}\n❌ Failed: ${stats.failed}\nTime: ${Math.round((Date.now()-startTime)/1000)}s`;
  console.log('\n' + msg.replace(/<[^>]*>?/gm, ''));
  await sendTelegramMessage(msg);
}

main().catch(async (e) => {
  console.error(e);
  await closeBrowser();
  await sendTelegramMessage(`🚨 <b>FATAL ERROR</b>\n<pre>${e.message}</pre>`);
  process.exit(1);
});
