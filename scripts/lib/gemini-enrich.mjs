/**
 * Gemini AI enrichment: call Gemini with product image + data, get title, description,
 * subtype, category, style, brand, colors, price (calculated by formula).
 * Used by import-yupoo-to-sanity.mjs (--ai) and enrich-products-with-gemini.mjs.
 */

const RATE_CNY = 6.5;
const RATE_UZS = 12_000;
const SHIP_AIR_PER_KG = 10;
const PACKAGING_USD = 1.5;
const MARKUP_MIN = 1.8;
const MARKUP_MAX = 2.1;
const DEFAULT_MARKUP = 1.95;

/** Default weight (kg) by product type keyword for fallback price calculation */
const DEFAULT_WEIGHT_BY_TYPE = {
  hoodie: 1,
  худи: 1,
  jacket: 1.2,
  куртка: 1.2,
  jeans: 0.8,
  джинсы: 0.8,
  jorts: 0.5,
  шорты: 0.5,
  tee: 0.4,
  футболка: 0.4,
  shirt: 0.4,
  рубашка: 0.4,
  vest: 0.6,
  жилет: 0.6,
  fleece: 0.9,
  флис: 0.9,
  knit: 0.5,
  свитер: 0.6,
};

/**
 * Round UZS price so the last digit of (price/10000) is 5 or 9 (e.g. 450000, 490000, 590000).
 * Keeps catalog prices consistent for the same yuan price.
 */
export function roundPriceToNiceUzs(uzs) {
  if (uzs == null || !Number.isFinite(uzs)) return uzs;
  const n = Math.round(uzs / 10000);
  const r = n % 10;
  const nRounded = r <= 5 ? Math.floor(n / 10) * 10 + 5 : Math.floor(n / 10) * 10 + 9;
  return nRounded * 10000;
}

/**
 * Calculate price in UZS using the cost formula (for fallback when AI doesn't return priceUzs).
 * @param {number} priceYuan - Supplier price in CNY
 * @param {number} weightKg - Estimated weight in kg
 * @param {number} [markup] - Optional markup (default 1.95)
 * @returns {number} Sale price in UZS (rounded to ...50k or ...90k)
 */
export function calculatePriceUzs(priceYuan, weightKg, markup = DEFAULT_MARKUP) {
  const purchaseUsd = priceYuan / RATE_CNY;
  const shippingUsd = weightKg * SHIP_AIR_PER_KG;
  const costUsd = purchaseUsd + shippingUsd + PACKAGING_USD;
  const costUzs = costUsd * RATE_UZS;
  return roundPriceToNiceUzs(Math.round(costUzs * markup));
}

/**
 * Guess weight (kg) from title/subtype for fallback price.
 * @param {string} title
 * @param {string} [subtype]
 * @returns {number}
 */
export function guessWeightKg(title, subtype) {
  const text = `${title || ''} ${subtype || ''}`.toLowerCase();
  for (const [key, w] of Object.entries(DEFAULT_WEIGHT_BY_TYPE)) {
    if (text.includes(key)) return w;
  }
  return 0.8; // default
}

/**
 * Build the system prompt for Gemini (categories, styles, brands, examples, price formula).
 */
function buildPrompt(options) {
  const {
    title,
    priceYuan,
    brandName,
    categories,
    styles,
    brands,
    exampleProducts = [],
  } = options;

  let categoriesText = '';
  if (categories?.length) {
    categoriesText = categories
      .map(
        (c) =>
          `${c.title} (slug: ${c.slug?.current || c.slug})${c.subtypes?.length ? ', подтипы: ' + c.subtypes.join(', ') : ''}`
      )
      .join('; ');
  }
  let stylesText = '';
  if (styles?.length) {
    stylesText = styles.map((s) => `${s.title} (slug: ${s.slug?.current || s.slug})`).join('; ');
  }
  let brandsText = '';
  if (brands?.length) {
    brandsText = brands.map((b) => `${b.title} (slug: ${b.slug?.current || b.slug})`).join('; ');
  }

  let examplesBlock = '';
  if (exampleProducts.length > 0) {
    examplesBlock = `\n\nПримеры готовых товаров (заполняй в таком же формате):\n${exampleProducts
      .map(
        (p) =>
          `- Название: ${p.title}\n  Описание: ${(p.description || '').slice(0, 200)}...\n  Подтип: ${p.subtype || '-'}, Категория: ${p.category || '-'}, Стиль: ${p.style || '-'}, Бренд: ${p.brand || '-'}, Цвета: ${Array.isArray(p.colors) ? p.colors.join(', ') : '-'}`
      )
      .join('\n')}`;
  } else {
    examplesBlock = `
Формат описания: блоки "Вес", "Ткань", "Детали", "Крой" на русском.
Формат названия: "Бренд Название (Подтип)" на русском.
Цвета: массив строк на английском (Black, Burgundy, Olive и т.д.).`;
  }

  return `Ты помощник для каталога одежды (стритвир). По фото товара и данным ниже заполни карточку и рассчитай цену.

Данные товара:
- Название с сайта: ${title || 'не указано'}
- Цена у поставщика (юани): ${priceYuan ?? 'не указано'}
- Бренд: ${brandName || 'не указано'}

Категории (верни categorySlug строго одним из slug): ${categoriesText || 'нет'}
Стили (верни styleSlug строго одним из slug): ${stylesText || 'нет'}
Бренды (верни brandSlug строго одним из slug): ${brandsText || 'нет'}
${examplesBlock}

Расчёт цены (обязательно):
1. Оцени вес товара в кг по фото и типу (худи ~1, джинсы ~0.8, футболка ~0.4, шорты ~0.5, куртка ~1.2).
2. Закуп ($) = Price_CNY / 6.5
3. Доставка ($) = Weight * 10
4. Себестоимость ($) = Закуп + Доставка + 1.5
5. Себестоимость (сум) = Себестоимость ($) * 12000
6. Цена продажи (сум) = Себестоимость (сум) * наценка (выбери от 1.8 до 2.1 для Lux-сегмента)

Верни ТОЛЬКО валидный JSON без markdown, с полями:
title (string), description (string), subtype (string), categorySlug (string), styleSlug (string), brandSlug (string), colors (array of strings), priceUzs (number), weightKg (number), markup (number)`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Call Gemini API with image (base64) and prompt; return parsed JSON or null.
 * Supports multiple API keys: on 429/503 tries the next key after a short pause.
 * @param {object} params
 * @param {string} params.imageBase64 - First product image as base64
 * @param {string} params.title - Raw title from Yupoo
 * @param {number} [params.priceYuan] - Price in CNY
 * @param {string} [params.brandName] - Brand title
 * @param {Array} [params.categories] - [{ title, slug: { current }, subtypes }]
 * @param {Array} [params.styles] - [{ title, slug: { current } }]
 * @param {Array} [params.brands] - [{ title, slug: { current } }]
 * @param {Array} [params.exampleProducts] - [{ title, description, subtype, category, style, brand, colors }]
 * @param {string} [params.apiKey] - Single GEMINI_API_KEY (used if apiKeys not set)
 * @param {string[]} [params.apiKeys] - Multiple keys; on 429/503 the next key is tried
 * @returns {Promise<object|null>} Parsed response or null on error
 */
export async function callGeminiForProduct(params) {
  const {
    imageBase64,
    title,
    priceYuan,
    brandName,
    categories,
    styles,
    brands,
    exampleProducts,
    apiKey,
    apiKeys: apiKeysParam,
  } = params;

  const apiKeys = Array.isArray(apiKeysParam) && apiKeysParam.length > 0
    ? apiKeysParam.map((k) => String(k).replace(/\r\n?|\n/g, '').trim()).filter(Boolean)
    : apiKey?.trim()
      ? [apiKey.trim()]
      : [];

  if (apiKeys.length === 0) return null;

  const prompt = buildPrompt({
    title,
    priceYuan,
    brandName,
    categories,
    styles,
    brands,
    exampleProducts: exampleProducts || [],
  });

  const body = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  };

  let lastError = null;
  for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
    const key = apiKeys[keyIndex];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const errText = await res.text();
      if (res.ok) {
        const data = JSON.parse(errText);
        const text =
          data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!text) return null;
        let raw = text.trim();
        if (raw.startsWith('```')) raw = raw.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
        return JSON.parse(raw);
      }
      const isQuotaOrOverload = res.status === 429 || res.status === 503;
      lastError = new Error(`Gemini API ${res.status}: ${errText.slice(0, 150)}`);
      if (isQuotaOrOverload && keyIndex < apiKeys.length - 1) {
        if (apiKeys.length > 1) {
          console.error(`Gemini key ${keyIndex + 1}/${apiKeys.length} quota/overload, trying next key in 3s...`);
        }
        await sleep(3000);
        continue;
      }
      console.error('Gemini call failed:', lastError.message);
      return null;
    } catch (e) {
      lastError = e;
      if (keyIndex < apiKeys.length - 1 && apiKeys.length > 1) {
        console.error(`Gemini key ${keyIndex + 1}/${apiKeys.length} failed (${e.message}), trying next key in 3s...`);
        await sleep(3000);
        continue;
      }
      console.error('Gemini call failed:', e.message);
      return null;
    }
  }
  if (lastError) console.error('Gemini call failed:', lastError.message);
  return null;
}

export const PRICE_CONSTANTS = { RATE_CNY, RATE_UZS, SHIP_AIR_PER_KG, PACKAGING_USD, MARKUP_MIN, MARKUP_MAX };
