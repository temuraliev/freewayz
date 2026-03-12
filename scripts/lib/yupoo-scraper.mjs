/**
 * Shared Yupoo scraping utilities.
 * Uses plain fetch + cheerio (no Playwright) so it works on Vercel serverless.
 * The heavy import flow (download images, upload to Sanity, AI enrich)
 * is handled by importSingleAlbum which relies on the existing import pipeline.
 */
import * as cheerio from 'cheerio';
import {
  callGeminiForProduct,
  calculatePriceUzs,
  guessWeightKg,
  roundPriceToNiceUzs,
  normalizeSubtype,
} from './gemini-enrich.mjs';
import { compressImageToMaxBytes } from './compress-image.mjs';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

const MIN_IMAGE_SIZE_BYTES = 150 * 1024;

function resolveUrl(href, base) {
  if (!href) return '';
  if (href.startsWith('http')) return href;
  if (href.startsWith('//')) return 'https:' + href;
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

function isRealImageUrl(url) {
  if (!url || url.startsWith('data:')) return false;
  const u = url.startsWith('//') ? 'https:' + url : url;
  return (
    u.startsWith('http') &&
    !u.includes('avatar') &&
    !u.includes('logo') &&
    !u.includes('icon')
  );
}

function slugify(text, fallback = 'product') {
  if (!text || typeof text !== 'string') return fallback;
  const s = text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return s || fallback;
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

// ─── HTTP fetch with retries ────────────────────────────────

async function fetchHtml(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
      if (!res.ok && res.status !== 522) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.text();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

async function fetchImageHead(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', headers: HEADERS, redirect: 'follow' });
    const len = parseInt(res.headers.get('content-length') || '0', 10);
    return { ok: res.ok, size: len };
  } catch {
    return { ok: false, size: 0 };
  }
}

// ─── Parsers ────────────────────────────────────────────────

export function parseCategoryAlbums(html, baseUrl) {
  const links = [];
  const $ = cheerio.load(html);
  const origin = baseUrl.startsWith('http') ? new URL(baseUrl).origin : '';

  const nextData = $('script#__NEXT_DATA__').html();
  if (nextData) {
    try {
      const data = JSON.parse(nextData);
      const albums =
        data?.props?.pageProps?.albums ??
        data?.props?.pageProps?.albumList ??
        data?.props?.pageProps?.list ??
        [];
      const items = Array.isArray(albums) ? albums : albums?.items ?? [];
      for (const item of items) {
        const id = item.id ?? item.album_id ?? item._id;
        const link = item.link ?? item.url;
        if (id) {
          const href =
            link && link.startsWith('http')
              ? link
              : `${origin}/albums/${id}`;
          if (!links.includes(href)) links.push(href);
        }
      }
    } catch {}
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

export function parseAlbumImages(html, albumUrl) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const urls = [];
  $('img').each((_, el) => {
    const dataOrigin = $(el).attr('data-origin-src');
    const dataOriginal = $(el).attr('data-original');
    const dataSrc = $(el).attr('data-src');
    const src = $(el).attr('src');
    const candidates = [dataOrigin, dataOriginal, src, dataSrc].filter(Boolean);
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

export function parseAlbumTitle(html) {
  const $ = cheerio.load(html);
  return (
    $('title').text().trim() ||
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    'Product'
  );
}

export function extractAlbumId(url) {
  const m = url.match(/\/albums\/(\d+)/);
  return m ? m[1] : null;
}

// ─── High-level functions ───────────────────────────────────

/**
 * Fetch all album URLs from a supplier page (handles pagination).
 * Returns array of album URLs.
 */
export async function fetchAlbumList(supplierUrl, maxPages = 50) {
  const baseUrl = supplierUrl.replace(/\?.*$/, '');
  const isRoot =
    baseUrl.endsWith('.com') ||
    baseUrl.endsWith('.com/') ||
    baseUrl.endsWith('/albums') ||
    baseUrl.endsWith('/albums/');
  const catUrl = isRoot
    ? baseUrl.replace(/\/?$/, '/albums/')
    : baseUrl;

  const seen = new Set();
  const all = [];

  for (let page = 1; page <= maxPages; page++) {
    const pageUrl =
      page === 1
        ? catUrl
        : catUrl + (catUrl.includes('?') ? '&' : '?') + 'page=' + page;
    try {
      const html = await fetchHtml(pageUrl);
      const albums = parseCategoryAlbums(html, pageUrl);
      if (albums.length === 0) break;
      let added = 0;
      for (const u of albums) {
        if (!seen.has(u)) {
          seen.add(u);
          all.push(u);
          added++;
        }
      }
      if (added === 0) break;
    } catch (e) {
      console.error(`fetchAlbumList page ${page} error: ${e.message}`);
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  return all;
}

/**
 * Fetch details for a single album: title, price text, image URLs (up to maxImages).
 * Uses HEAD requests to filter small images for speed.
 */
export async function fetchAlbumDetails(albumUrl, maxImages = 5) {
  const html = await fetchHtml(albumUrl);
  const title = parseAlbumTitle(html);
  const allImages = parseAlbumImages(html, albumUrl);

  const validImages = [];
  for (const imgUrl of allImages) {
    if (validImages.length >= maxImages) break;
    const head = await fetchImageHead(imgUrl);
    if (head.ok && head.size >= MIN_IMAGE_SIZE_BYTES) {
      validImages.push(imgUrl);
    } else if (head.ok && head.size === 0) {
      validImages.push(imgUrl);
    }
  }

  return { title, imageUrls: validImages, allImageUrls: allImages };
}

/**
 * Full import of a single Yupoo album: download images, enrich with AI, create Sanity draft.
 * Called from the admin bot import flow.
 */
export async function importSingleAlbum({
  albumUrl,
  brandId,
  styleId,
  subtype,
  sanityClient,
}) {
  if (!sanityClient) return { ok: false, error: 'No Sanity client' };

  try {
    const html = await fetchHtml(albumUrl);
    const rawTitle = parseAlbumTitle(html);
    const allImages = parseAlbumImages(html, albumUrl);

    if (allImages.length === 0) {
      return { ok: false, error: 'No images found in album' };
    }

    const imageBuffers = [];
    for (const imgUrl of allImages.slice(0, 10)) {
      try {
        const res = await fetch(imgUrl, { headers: HEADERS, redirect: 'follow' });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length >= MIN_IMAGE_SIZE_BYTES) {
          imageBuffers.push(buf);
        }
      } catch {}
    }

    if (imageBuffers.length === 0) {
      return { ok: false, error: 'No valid images downloaded' };
    }

    const uploadedAssets = [];
    for (const buf of imageBuffers) {
      try {
        const compressed = await compressImageToMaxBytes(buf, 500 * 1024);
        const asset = await sanityClient.assets.upload('image', compressed, {
          filename: `yupoo-${Date.now()}.jpg`,
          contentType: 'image/jpeg',
        });
        uploadedAssets.push(asset);
      } catch (e) {
        console.error('Image upload error:', e.message);
      }
    }

    if (uploadedAssets.length === 0) {
      return { ok: false, error: 'Image upload failed' };
    }

    const brand = brandId
      ? await sanityClient.fetch(`*[_type == "brand" && _id == $id][0]{ _id, title, "slug": slug.current }`, { id: brandId })
      : null;
    const style = styleId
      ? await sanityClient.fetch(`*[_type == "style" && _id == $id][0]{ _id, title, "slug": slug.current }`, { id: styleId })
      : null;

    let aiResult = null;
    try {
      const imagesBase64 = imageBuffers.slice(0, 4).map((b) => b.toString('base64'));
      const examples = await sanityClient.fetch(
        `*[_type == "product" && defined(title) && defined(price)] | order(_updatedAt desc) [0...3] { title, "description": pt::text(description), price, subtype, "brand": brand->title, "category": category->title }`
      );
      aiResult = await callGeminiForProduct({
        imageBase64List: imagesBase64,
        rawYupooTitle: rawTitle,
        brandHint: brand?.title || '',
        categoryHint: '',
        styleHint: style?.title || '',
        existingExamples: examples || [],
      });
    } catch (e) {
      console.error('AI enrich error:', e.message);
    }

    const normalizedSubtype = normalizeSubtype(subtype || aiResult?.subtype);
    const title = aiResult?.title || rawTitle;
    const priceRaw = aiResult?.price_cny
      ? roundPriceToNiceUzs(calculatePriceUzs(aiResult.price_cny, guessWeightKg(normalizedSubtype || 'product')))
      : 300000;

    const catSlug = aiResult?.category || 'odezhda';
    const category = await sanityClient.fetch(
      `*[_type == "category" && slug.current == $s][0]{ _id }`,
      { s: catSlug }
    );

    const slugBase = [
      catSlug,
      style?.slug || 'style',
      brand?.slug || 'brand',
    ].join('_');

    const titlePart = slugify(title).slice(0, 40);
    const existing = await sanityClient.fetch(
      `count(*[_type == "product" && slug.current match $p])`,
      { p: `${slugBase}*` }
    );
    const slugCurrent = [slugBase, titlePart || 'product', (existing || 0) + 1].join('_');

    const images = uploadedAssets.map((a, i) => ({
      _key: `img${i}`,
      _type: 'image',
      asset: { _type: 'reference', _ref: a._id },
    }));

    const doc = {
      _type: 'product',
      _id: `drafts.${slugCurrent}`,
      title,
      slug: { _type: 'slug', current: slugCurrent },
      price: priceRaw,
      subtype: normalizedSubtype,
      images,
      sizes: aiResult?.sizes || ['S', 'M', 'L', 'XL'],
      colors: aiResult?.colors || [],
      isNewArrival: true,
      sourceUrl: albumUrl,
    };

    if (brand?._id) doc.brand = { _type: 'reference', _ref: brand._id };
    if (style?._id) doc.style = { _type: 'reference', _ref: style._id };
    if (category?._id) doc.category = { _type: 'reference', _ref: category._id };

    if (aiResult?.description) {
      doc.description = [
        {
          _key: 'desc0',
          _type: 'block',
          children: [{ _key: 'c0', _type: 'span', text: aiResult.description, marks: [] }],
          markDefs: [],
          style: 'normal',
        },
      ];
    }

    await sanityClient.createOrReplace(doc);

    return {
      ok: true,
      title,
      price: priceRaw,
      slug: slugCurrent,
      id: doc._id,
    };
  } catch (e) {
    console.error('importSingleAlbum error:', e);
    return { ok: false, error: e.message };
  }
}
