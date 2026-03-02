#!/usr/bin/env node
/**
 * Import products from a Yupoo category or album: fetch high-quality images
 * (data-origin-src when available), download them, upload to Sanity, create product docs.
 *
 * Usage:
 *   node --env-file=.env.local scripts/import-yupoo-to-sanity.mjs <categoryOrAlbumUrl> [options]
 *
 * Options:
 *   --from N --to M Import albums from position N to M (e.g. --from 1 --to 10 = first 10 albums). Slug = category_style_brand_N.
 *   --max N         Alternative: max products (same as --from 1 --to N). Default 5.
 *   --brand SLUG    Brand slug in Sanity (e.g. broken-planet).
 *   --category SLUG Category slug in Sanity (e.g. obuv).
 *   --style SLUG    Style slug in Sanity (e.g. opium).
 *
 * Slug format: category_style_brand_<number> (e.g. odezhda_opium_broken-planet_1, odezhda_opium_broken-planet_2).
 *
 * Works with any Yupoo subdomain (rainbowreps, pengreps, etc.). Origin is taken from the URL.
 * Category URLs: all pages are fetched (?page=1, ?page=2, …) until a page returns no albums.
 *
 * Examples:
 *   ... "https://pengreps.x.yupoo.com/categories/4830286" --from 1 --to 10 --brand ders --category odezhda --style opium
 *   ... "https://rainbowreps.x.yupoo.com/categories/4834693" --max 5
 *   ... "https://elephant-brother.x.yupoo.com/" --max 90  (albums index, all pages)
 *   ... "https://any-supplier.x.yupoo.com/albums/123456" --from 1 --to 1 --brand hellstar --category obuv --style uk-drill
 *
 * Requires .env.local: NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN
 * With --ai: GEMINI_API_KEY (Google AI Studio). Brand, Category, Style must exist in Sanity.
 */

import { createClient } from '@sanity/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import {
  callGeminiForProduct,
  calculatePriceUzs,
  guessWeightKg,
  roundPriceToNiceUzs,
} from './lib/gemini-enrich.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DELAY_MS = 700;
const DEFAULT_MAX_PRODUCTS = 5;
const DEFAULT_PRICE_UZS = 200_000;
const YUAN_TO_UZS = 1_600;
/** Skip images smaller than this (bytes). 150 KB = 153600 */
const MIN_IMAGE_SIZE_BYTES = 150 * 1024;

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

function resolveUrl(url, base) {
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

/** Parse price from title like "¥~158" or "¥\~329" -> 158 */
function parsePriceFromTitle(title) {
  const m = title.match(/[¥￥]\s*\\?~?\s*(\d+)/);
  if (m) return parseInt(m[1], 10);
  return null;
}

/** Clean product title: remove price prefix and size note for slug */
function cleanTitle(raw) {
  return raw
    .replace(/^[¥￥\s\\~0-9]+\s*/i, '')
    .replace(/\s*（[^）]*im\s+\d+cm[^）]*）\s*$/i, '')
    .replace(/\s*\([^)]*im\s+\d+cm[^)]*\)\s*$/i, '')
    .trim() || 'Broken Planet Item';
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'product';
}

async function fetchHtml(url, referer) {
  const ref = referer || (url && url.startsWith('http') ? new URL(url).origin : '');
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      Referer: ref || undefined,
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

async function fetchImageBuffer(url, referer) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Referer: referer,
      Accept: 'image/*',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Image HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

/** Get album URLs from a category page. Tries __NEXT_DATA__ (SPA) then <a href>. origin = e.g. https://pengreps.x.yupoo.com */
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
    } catch (e) {
      // ignore JSON parse error
    }
  }

  if (links.length === 0) {
    $('a[href*="/albums/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        const full = resolveUrl(href, baseUrl);
        // Only real album pages (/albums/123456), not pagination (/albums/?page=2)
        if (/\/albums\/\d+/.test(full) && !links.includes(full)) links.push(full);
      }
    });
  }
  return [...new Set(links)];
}

/** Fetch all pages of a category and return deduplicated album URLs. Stops when a page returns 0 albums or maxPages reached. */
const MAX_CATEGORY_PAGES = 100;

async function fetchAllCategoryPages(categoryUrl, origin) {
  const baseUrl = categoryUrl.replace(/\?.*$/, '');
  const seen = new Set();
  const allAlbums = [];
  let page = 1;

  while (page <= MAX_CATEGORY_PAGES) {
    const pageUrl = page === 1 ? baseUrl : baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'page=' + page;
    const html = await fetch(pageUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        Referer: origin || baseUrl,
      },
      redirect: 'follow',
    }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} ${pageUrl}`);
      return r.text();
    });
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
    if (page === 1) {
      console.log('Page 1:', albums.length, 'album(s)');
    } else {
      console.log('Page', page, ':', albums.length, 'album(s), total', allAlbums.length);
    }
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

/** Normalize URL for dedupe: same path = same image (ignore query params like ?width=). */
function normalizeImageUrl(url) {
  try {
    const u = new URL(url.startsWith('//') ? 'https:' + url : url);
    u.search = '';
    return u.href;
  } catch {
    return url;
  }
}

/** Extract high-quality image URLs from album page. Dedupe by normalized URL so the same photo isn't added multiple times. */
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
  return cleanTitle(title.trim()) || 'Broken Planet Item';
}

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

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) {
      fromNum = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--to' && args[i + 1]) {
      toNum = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--max' && args[i + 1]) {
      maxProducts = parseInt(args[i + 1], 10) || DEFAULT_MAX_PRODUCTS;
      i++;
    } else if (args[i] === '--brand' && args[i + 1]) {
      brandSlug = args[i + 1].trim();
      i++;
    } else if (args[i] === '--category' && args[i + 1]) {
      categorySlug = args[i + 1].trim();
      i++;
    } else if (args[i] === '--style' && args[i + 1]) {
      styleSlug = args[i + 1].trim();
      i++;
    } else if (args[i] === '--ai') {
      useAi = true;
    }
  }

  if (!url) {
    console.error('Usage: node --env-file=.env.local scripts/import-yupoo-to-sanity.mjs <categoryOrAlbumUrl> [--from N --to M] [--max N] [--brand SLUG] [--category SLUG] [--style SLUG] [--ai]');
    console.error('Example: ... "https://pengreps.x.yupoo.com/categories/4830286" --from 1 --to 10 --brand ders --category odezhda --style opium');
    process.exit(1);
  }

  let origin;
  try {
    origin = new URL(url).origin;
  } catch (e) {
    console.error('Invalid URL:', url);
    process.exit(1);
  }
  const isSingleAlbum = /\/albums\/\d+/.test(url.replace(/\?.*$/, ''));
  const isCategory = url.includes('/categories/');
  const isAlbumsIndex =
    url.includes('.yupoo.com') &&
    !isCategory &&
    !isSingleAlbum &&
    (url === origin + '/' ||
      url === origin ||
      url.replace(/\?.*$/, '').endsWith('/albums') ||
      url.replace(/\?.*$/, '').endsWith('/albums/'));

  if (!isCategory && !isSingleAlbum && !isAlbumsIndex) {
    console.error(
      'URL must be: Yupoo category (/categories/...), single album (/albums/123), or site root (e.g. https://elephant-brother.x.yupoo.com/)'
    );
    process.exit(1);
  }

  // Resolve range: --from/--to take precedence over --max
  let rangeFrom = 1;
  let rangeTo = maxProducts;
  if (fromNum != null && toNum != null) {
    rangeFrom = Math.max(1, fromNum);
    rangeTo = Math.max(rangeFrom, toNum);
  } else if (fromNum != null || toNum != null) {
    console.error('Use both --from N and --to M together (e.g. --from 1 --to 10).');
    process.exit(1);
  }

  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
  const token = (process.env.SANITY_API_TOKEN || '').replace(/\r\n?|\n/g, '').trim();

  if (!projectId || !token) {
    console.error('Set NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_TOKEN in .env.local');
    process.exit(1);
  }

  const client = createClient({
    projectId,
    dataset,
    apiVersion: '2024-01-01',
    useCdn: false,
    token,
  });

  try {
    await client.fetch('*[_type == "product"][0]{_id}');
  } catch (e) {
    console.error('Sanity token check failed:', e.message);
    const msg = String(e.message);
    if (msg.includes('Unauthorized') || msg.includes('Session not found')) {
      console.error('\nТокен не подходит. Создай новый API token с правом Editor в sanity.io/manage → проект → API → Tokens.');
    } else if (msg.includes('project user not found') || msg.includes('user ID')) {
      console.error('\nТокен создан не для этого проекта. Сделай так:');
      console.error('1. Зайди на https://www.sanity.io/manage');
      console.error('2. Выбери именно тот проект, где твой датасет (ID в .env: NEXT_PUBLIC_SANITY_PROJECT_ID)');
      console.error('3. Убедись, что твой аккаунт в Members этого проекта');
      console.error('4. В этом проекте: API → Tokens → Add API token → Editor; при "Select Projects" укажи этот проект (или All Projects)');
      console.error('5. Скопируй новый токен в .env.local: SANITY_API_TOKEN=...');
    }
    process.exit(1);
  }

  const brandSlugToUse = brandSlug || 'broken-planet';
  const styleSlugToUse = styleSlug;

  let brandId, categoryId, styleId;
  try {
    const queries = [
      client.fetch('*[_type == "brand" && slug.current == $slug][0]{_id}', { slug: brandSlugToUse }),
      categorySlug
        ? client.fetch('*[_type == "category" && slug.current == $slug][0]{_id}', { slug: categorySlug })
        : Promise.resolve(null),
      styleSlugToUse
        ? client.fetch('*[_type == "style" && slug.current == $slug][0]{_id}', { slug: styleSlugToUse })
        : Promise.resolve(null),
    ];
    const [brand, category, style] = await Promise.all(queries);
    brandId = brand?._id;
    categoryId = category?._id;
    styleId = style?._id;
  } catch (e) {
    console.error('Failed to fetch brand/category/style:', e.message);
  }
  if (!brandId) console.warn('Brand with slug "' + brandSlugToUse + '" not found in Sanity. Create it in Studio. Products will be created without brand.');
  if (categorySlug && !categoryId) console.warn('Category with slug "' + categorySlug + '" not found. Create it in Studio or omit --category.');
  if (styleSlugToUse && !styleId) console.warn('Style with slug "' + styleSlugToUse + '" not found. Products will be created without style.');
  if (!styleSlugToUse && !styleId) {
    const firstStyle = await client.fetch('*[_type == "style"][0]{_id}').catch(() => null);
    styleId = firstStyle?._id;
    if (!styleId) console.warn('No style in Sanity. Create at least one style in Studio. Products will be created without style.');
  }

  let aiContext = null;
  if (useAi) {
    const keysEnv = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    const apiKeys = keysEnv
      .split(',')
      .map((k) => k.replace(/\r\n?|\n/g, '').trim())
      .filter(Boolean);
    if (apiKeys.length === 0) {
      console.warn('--ai requested but GEMINI_API_KEY / GEMINI_API_KEYS not set in .env.local. Proceeding without AI.');
      useAi = false;
    } else {
      try {
        const [categoriesList, stylesList, brandsList, examples] = await Promise.all([
          client.fetch('*[_type == "category"]{ _id, title, "slug": slug.current, subtypes }'),
          client.fetch('*[_type == "style"]{ _id, title, "slug": slug.current }'),
          client.fetch('*[_type == "brand"]{ _id, title, "slug": slug.current }'),
          client.fetch(
            '*[_type == "product" && defined(description) && description != ""][0...3]{ title, description, subtype, "category": category->title, "style": style->title, "brand": brand->title, colors }'
          ),
        ]);
        aiContext = {
          apiKeys,
          categories: categoriesList || [],
          styles: stylesList || [],
          brands: brandsList || [],
          exampleProducts: examples || [],
        };
        console.log('AI context loaded: categories', aiContext.categories.length, 'styles', aiContext.styles.length, 'brands', aiContext.brands.length);
      } catch (e) {
        console.warn('Failed to load AI context:', e.message);
        useAi = false;
      }
    }
  }

  let albumUrls = [];
  const fetchBaseUrl = isCategory ? url : isAlbumsIndex ? origin + '/albums/' : null;

  if (isCategory || isAlbumsIndex) {
    const label = isCategory ? 'category' : 'albums index';
    console.log('Fetching ' + label + ' (all pages)...', fetchBaseUrl);
    const allAlbums = await fetchAllCategoryPages(fetchBaseUrl, origin);
    console.log('Found', allAlbums.length, 'album(s) total. Importing from', rangeFrom, 'to', rangeTo);
    albumUrls = allAlbums.slice(rangeFrom - 1, rangeTo);
    if (albumUrls.length === 0) {
      console.error('No albums in range. Check --from/--to (e.g. --from 1 --to 10).');
      process.exit(1);
    }
    await sleep(DELAY_MS);
  } else if (isSingleAlbum) {
    albumUrls = [url];
    if (rangeFrom !== 1 || rangeTo !== 1) {
      console.warn('Single album URL: --from/--to ignored, using slug number 1.');
    }
    rangeFrom = 1;
    rangeTo = 1;
  }

  // Slug format: category_style_brand_<number>
  const categorySlugSafe = categorySlug || 'product';
  const styleSlugSafe = styleSlug || 'style';
  const brandSlugSafe = brandSlugToUse || 'brand';
  const slugBase = [categorySlugSafe, styleSlugSafe, brandSlugSafe].join('_');

  let created = 0;
  let failed = 0;

  for (let i = 0; i < albumUrls.length; i++) {
    const albumUrl = albumUrls[i];
    console.log('\n[' + (i + 1) + '/' + albumUrls.length + '] Album:', albumUrl);

    try {
      const albumOrigin = new URL(albumUrl).origin;
      const html = await fetchHtml(albumUrl, albumOrigin);
      await sleep(DELAY_MS);

      const imageUrls = parseAlbumPageImages(html, albumUrl);
      if (imageUrls.length === 0) {
        console.log('  No images found (page may use lazy-load). Skip.');
        failed++;
        continue;
      }
      console.log('  Images found:', imageUrls.length, '(using high-res when available)');

      const title = parseAlbumTitle(html);
      const priceYuan = parsePriceFromTitle(html) || parsePriceFromTitle(title);
      const albumIdMatch = albumUrl.match(/\/albums\/(\d+)/);
      const slug =
        albumIdMatch && albumUrls.length === 1
          ? slugBase + '_' + albumIdMatch[1]
          : slugBase + '_' + (rangeFrom + i);

      let aiResult = null;
      let firstBuffer = null;

      if (useAi && aiContext) {
        try {
          firstBuffer = await fetchImageBuffer(imageUrls[0], albumOrigin);
          if (firstBuffer.length >= MIN_IMAGE_SIZE_BYTES) {
            const imageBase64 = firstBuffer.toString('base64');
            const brandTitle =
              aiContext.brands.find((b) => (b.slug || b.slug?.current) === brandSlugToUse)?.title || brandSlugToUse;
            aiResult = await callGeminiForProduct({
              imageBase64,
              title,
              priceYuan: priceYuan ?? undefined,
              brandName: brandTitle,
              categories: aiContext.categories,
              styles: aiContext.styles,
              brands: aiContext.brands,
              exampleProducts: aiContext.exampleProducts,
              apiKeys: aiContext.apiKeys,
            });
            if (aiResult) console.log('  AI:', aiResult.title?.slice(0, 40), '...', aiResult.priceUzs != null ? aiResult.priceUzs + ' UZS' : '');
            await sleep(10000);
          }
        } catch (e) {
          console.log('  AI step failed:', e.message);
        }
      }

      const imageRefs = [];
      for (let j = 0; j < imageUrls.length; j++) {
        let buffer;
        if (j === 0 && firstBuffer) {
          buffer = firstBuffer;
        } else {
          try {
            buffer = await fetchImageBuffer(imageUrls[j], albumOrigin);
          } catch (e) {
            console.log('  Skip image', j + 1, e.message);
            continue;
          }
        }
        if (buffer.length < MIN_IMAGE_SIZE_BYTES) {
          console.log('  Skip image', j + 1, '(too small:', Math.round(buffer.length / 1024), 'KB, min 150 KB)');
          continue;
        }
        try {
          await sleep(200);
          const asset = await client.assets.upload('image', buffer, {
            filename: `yupoo-${i}-${j}.jpg`,
            contentType: 'image/jpeg',
          });
          imageRefs.push({
            _key: `img-${i}-${j}-${asset._id.slice(-6)}`,
            _type: 'image',
            asset: { _type: 'reference', _ref: asset._id },
          });
        } catch (e) {
          console.log('  Skip image', j + 1, e.message);
        }
      }

      if (imageRefs.length === 0) {
        console.log('  No images uploaded. Skip product.');
        failed++;
        continue;
      }

      let docTitle = title.slice(0, 90);
      let docPrice = roundPriceToNiceUzs(priceYuan ? Math.round(priceYuan * YUAN_TO_UZS) : DEFAULT_PRICE_UZS);
      let docDescription = undefined;
      let docSubtype = undefined;
      let docCategoryId = categoryId;
      let docStyleId = styleId;
      let docBrandId = brandId;
      let docColors = ['Black'];

      if (aiResult) {
        if (aiResult.title) docTitle = String(aiResult.title).slice(0, 90);
        if (aiResult.description) docDescription = String(aiResult.description);
        if (aiResult.subtype) docSubtype = String(aiResult.subtype);
        if (Array.isArray(aiResult.colors) && aiResult.colors.length > 0) docColors = aiResult.colors.map(String);
        if (aiResult.priceUzs != null && Number.isFinite(Number(aiResult.priceUzs))) {
          docPrice = roundPriceToNiceUzs(Math.round(Number(aiResult.priceUzs)));
        } else if (priceYuan != null) {
          docPrice = calculatePriceUzs(priceYuan, guessWeightKg(title, docSubtype));
        }
        if (aiResult.categorySlug && aiContext?.categories) {
          const cat = aiContext.categories.find((c) => (c.slug || c.slug?.current) === aiResult.categorySlug);
          if (cat?._id) docCategoryId = cat._id;
        }
        if (aiResult.styleSlug && aiContext?.styles) {
          const st = aiContext.styles.find((s) => (s.slug || s.slug?.current) === aiResult.styleSlug);
          if (st?._id) docStyleId = st._id;
        }
        if (aiResult.brandSlug && aiContext?.brands) {
          const br = aiContext.brands.find((b) => (b.slug || b.slug?.current) === aiResult.brandSlug);
          if (br?._id) docBrandId = br._id;
        }
      }

      const draftId = 'drafts.product-' + String(slug).replace(/[^a-zA-Z0-9_-]/g, '-');
      const doc = {
        _id: draftId,
        _type: 'product',
        title: docTitle,
        slug: { _type: 'slug', current: slug },
        price: docPrice,
        images: imageRefs,
        sizes: ['S', 'M', 'L', 'XL'],
        colors: docColors,
        isHotDrop: false,
        isOnSale: false,
        sourceUrl: albumUrl || undefined,
      };
      if (docDescription != null) doc.description = docDescription;
      if (docSubtype != null) doc.subtype = docSubtype;
      if (docBrandId) doc.brand = { _type: 'reference', _ref: docBrandId };
      if (docCategoryId) doc.category = { _type: 'reference', _ref: docCategoryId };
      if (docStyleId) doc.style = { _type: 'reference', _ref: docStyleId };

      await client.createOrReplace(doc);
      created++;
      console.log('  Draft:', slug, '—', docTitle.slice(0, 40), '...', docPrice, 'UZS');
    } catch (e) {
      console.error('  Error:', e.message);
      failed++;
    }

    await sleep(DELAY_MS);
  }

  console.log('\nDone. Drafts created:', created, 'Failed:', failed);
  if (created > 0) {
    console.log('Tip: Products are created as drafts. Publish them in Sanity Studio when ready.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
