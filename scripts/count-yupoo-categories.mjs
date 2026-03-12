#!/usr/bin/env node
/**
 * Count albums (products) in each Yupoo category/collection.
 * Uses same fetch/parse logic as import-yupoo-to-sanity.mjs.
 *
 * Usage: node scripts/count-yupoo-categories.mjs
 * Requires: playwright, cheerio. Run from project root.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const DELAY_MS = 400;

const CATEGORIES = [
  { url: 'https://rainbowreps.x.yupoo.com/categories/4840170', brand: 'denim-tears' },
  { url: 'https://deateath.x.yupoo.com/categories/4568347', brand: 'balenciaga' },
  { url: 'https://deateath.x.yupoo.com/categories/4645865', brand: 'acne-studios' },
  { url: 'https://deateath.x.yupoo.com/categories/4578564', brand: 'gallery-dept' },
  { url: 'https://rainbowreps.x.yupoo.com/categories/4843663', brand: 'bape' },
  { url: 'https://deateath.x.yupoo.com/categories/4640727', brand: 'cdg' },
  { url: 'https://deateath.x.yupoo.com/categories/4565034', brand: 'erd' },
  { url: 'https://scorpio-reps.x.yupoo.com/collections/5067670', brand: 'carhartt' },
  { url: 'https://rainbowreps.x.yupoo.com/categories/4827402', brand: 'stussy' },
  { url: 'https://deateath.x.yupoo.com/categories/4577008', brand: 'chrome-hearts' },
  { url: 'https://rainbowreps.x.yupoo.com/categories/4844081', brand: 'travis-scott' },
  { url: 'https://rainbowreps.x.yupoo.com/categories/4841811', brand: 'trapstar' },
  { url: 'https://rainbowreps.x.yupoo.com/categories/4847823', brand: 'vlone' },
  { url: 'https://deateath.x.yupoo.com/categories/4694798', brand: 'vetments' },
  { url: 'https://rainbowreps.x.yupoo.com/categories/4838375', brand: 'yeezy' },
  { url: 'https://deateath.x.yupoo.com/categories/4572100', brand: 'fear-of-god' },
  { url: 'https://deateath.x.yupoo.com/categories/4578563', brand: 'amiri' },
  { url: 'https://deateath.x.yupoo.com/categories/4631551', brand: 'hellstar' },
  { url: 'https://rainbowreps.x.yupoo.com/categories/4829652', brand: 'ami-paris' },
  { url: 'https://deateath.x.yupoo.com/categories/4639846', brand: 'adidas' },
  { url: 'https://deateath.x.yupoo.com/categories/4565034', brand: 'nike' },
  { url: 'https://deateath.x.yupoo.com/categories/4590777', brand: 'casablanca' },
  { url: 'https://angelking47.x.yupoo.com/categories/3848500', brand: 'eric-emanuel' },
  { url: 'https://pikachushop.x.yupoo.com/categories/4066349', brand: 'eric-emanuel' },
  { url: 'https://pikachushop.x.yupoo.com/categories/4609695', brand: 'eric-emanuel' },
  { url: 'https://deateath.x.yupoo.com/categories/4634017', brand: 'maison-margiela' },
  { url: 'https://scorpio-reps.x.yupoo.com/categories/4969709', brand: 'arcteryx' },
  { url: 'https://deateath.x.yupoo.com/categories/5123264', brand: 'stone-island' },
  { url: 'https://deateath.x.yupoo.com/categories/4571442', brand: 'cp-company' },
  { url: 'https://rainbowreps.x.yupoo.com/categories/4840140', brand: 'tommy-hilfiger' },
];

function loadEnvLocal() {
  const path = join(PROJECT_ROOT, '.env.local');
  if (!existsSync(path)) return;
  try {
    const content = readFileSync(path, 'utf8');
    for (const line of content.split('\n')) {
      const t = line.trim();
      if (t && !t.startsWith('#')) {
        const eq = t.indexOf('=');
        if (eq > 0) {
          let v = t.slice(eq + 1).trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
          process.env[t.slice(0, eq).trim()] = v.replace(/\r$/, '');
        }
      }
    }
  } catch (_) {}
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
    } catch (_) {}
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

let browser = null;
let browserContext = null;

async function initBrowser() {
  if (browser) return;
  browser = await chromium.launch({ headless: true });
  browserContext = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    extraHTTPHeaders: { 'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8' },
  });
}

async function closeBrowser() {
  if (browser) await browser.close();
  browser = null;
  browserContext = null;
}

async function fetchHtml(url, maxRetries = 3) {
  await initBrowser();
  const page = await browserContext.newPage();
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (!response) throw new Error('Timeout');
      if (response.status() >= 400) throw new Error(`HTTP ${response.status()}`);
      await page.waitForTimeout(800);
      const content = await page.content();
      await page.close();
      return content;
    } catch (e) {
      if (i === maxRetries - 1) {
        await page.close();
        throw e;
      }
      await sleep(1000 * Math.pow(2, i));
    }
  }
}

const MAX_PAGES = 200;

async function countAlbumsInCategory(categoryUrl) {
  const baseUrl = categoryUrl.replace(/\?.*$/, '');
  const origin = baseUrl.startsWith('http') ? new URL(baseUrl).origin : '';
  const seen = new Set();
  let total = 0;
  let page = 1;

  while (page <= MAX_PAGES) {
    const pageUrl = page === 1 ? baseUrl : baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'page=' + page;
    let html;
    try {
      html = await fetchHtml(pageUrl);
    } catch (e) {
      console.warn(`  ⚠ ${pageUrl}: ${e.message}`);
      break;
    }
    const albums = parseCategoryPage(html, pageUrl, origin);
    let added = 0;
    for (const u of albums) {
      if (!seen.has(u)) {
        seen.add(u);
        total++;
        added++;
      }
    }
    if (albums.length === 0 || added === 0) break;
    page++;
    await sleep(DELAY_MS);
  }
  return total;
}

async function main() {
  loadEnvLocal();
  console.log('Counting albums in each category (full category, all pages)...\n');

  const results = [];
  for (let i = 0; i < CATEGORIES.length; i++) {
    const { url, brand } = CATEGORIES[i];
    const baseUrl = url.replace(/\?.*$/, '');
    process.stdout.write(`[${i + 1}/${CATEGORIES.length}] ${brand} ... `);
    try {
      const count = await countAlbumsInCategory(baseUrl);
      results.push({ brand, url: baseUrl, count });
      console.log(count);
    } catch (e) {
      results.push({ brand, url: baseUrl, count: null, error: e.message });
      console.log('ERROR: ' + e.message);
    }
    await sleep(300);
  }

  await closeBrowser();

  console.log('\n--- Summary ---');
  let total = 0;
  results.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  for (const r of results) {
    const c = r.count ?? 0;
    if (r.error) console.log(`${r.brand}: ERROR (${r.error})`);
    else {
      console.log(`${r.brand}: ${c}`);
      total += c;
    }
  }
  console.log('\nTotal albums (all categories): ' + total);
}

main().catch(async (e) => {
  console.error(e);
  await closeBrowser();
  process.exit(1);
});
