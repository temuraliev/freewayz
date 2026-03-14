/**
 * Gemini AI enrichment: call Gemini with product images + data, get title, description,
 * subtype, category, style, brand, colors, price (calculated by formula).
 * Used by import-yupoo-to-sanity.mjs (--ai) and enrich-products-with-gemini.mjs.
 *
 * v2: multi-image support, strict JSON response_schema, lower temperature,
 *     real product examples for few-shot learning, gemini-2.0-flash model.
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
  hoodie: 1, худи: 1,
  jacket: 1.2, куртка: 1.2,
  puffer: 1.3, пуховик: 1.3,
  vest: 0.6, жилет: 0.6,
  windbreaker: 0.8, ветровка: 0.8,
  jeans: 0.8, джинсы: 0.8,
  pants: 0.7, штаны: 0.7, брюки: 0.7,
  shorts: 0.5, шорты: 0.5, jorts: 0.5,
  tee: 0.4, 't-shirt': 0.4, футболка: 0.4,
  shirt: 0.4, рубашка: 0.4,
  polo: 0.4, поло: 0.4,
  fleece: 0.9, флис: 0.9,
  knit: 0.5, свитер: 0.6,
  sweater: 0.6, кардиган: 0.6,
  belt: 0.5, ремень: 0.5,
  bag: 0.8, сумка: 0.8,
  cap: 0.3, кепка: 0.3, шапка: 0.3,
  sneakers: 1.2, кроссовки: 1.2,
  shoes: 1.0, обувь: 1.0,
  boots: 1.4, ботинки: 1.4,
  suit: 1.4, костюм: 1.4,
};

/** "зип-худи" is deprecated — always store as "зипки". */
export function normalizeSubtype(subtype) {
  if (subtype == null || typeof subtype !== "string") return subtype;
  const s = String(subtype).trim();
  const lower = s.toLowerCase();
  if (lower === "зип-худи" || lower === "зип худи" || lower === "зип-худі" || lower.includes("зип") && lower.includes("худи")) return "Зипки";
  if (lower === "свитшот" || lower === "свэтшот") return "Свитшоты";
  if (lower === "футболка" || lower === "футболки" || lower === "t-shirt") return "Футболки";
  if (lower === "худи" || lower === "hoodie") return "Худи";
  if (lower === "джинсы" || lower === "jeans") return "Джинсы";
  if (lower === "кепка" || lower === "cap") return "Кепки";
  if (lower === "кроссовки" || lower === "sneakers") return "Кроссовки";
  if (lower === "шорты" || lower === "shorts") return "Шорты";
  if (lower === "джорты" || lower === "jorts") return "Джорты";
  if (lower === "штаны" || lower === "pants") return "Штаны";
  if (lower === "куртка" || lower === "jacket") return "Куртки";
  if (lower === "ветровка" || lower === "windbreaker") return "Ветровки";
  if (lower === "пуховик" || lower === "puffer") return "Пуховики";
  if (lower === "рюкзак" || lower === "backpack") return "Рюкзаки";
  if (lower === "сумка" || lower === "bag") return "Сумки";
  if (lower === "шапка" || lower === "beanie") return "Шапки";
  if (lower === "ремень" || lower === "belt") return "Ремни";
  return s;
}

/**
 * Round UZS price so the last digit of (price/10000) is 5 or 9 (e.g. 450000, 490000, 590000).
 */
export function roundPriceToNiceUzs(uzs) {
  if (uzs == null || !Number.isFinite(uzs)) return uzs;
  const base100k = Math.floor(uzs / 100000) * 100000;
  const candidates = [
    base100k - 50000, // e.g. 350k
    base100k - 10000, // e.g. 390k
    base100k + 50000, // e.g. 450k
    base100k + 90000, // e.g. 490k
    base100k + 150000 // e.g. 550k
  ];
  let closest = candidates[0];
  let minDiff = Math.abs(uzs - closest);
  for (const c of candidates) {
    const diff = Math.abs(uzs - c);
    if (diff < minDiff) {
      minDiff = diff;
      closest = c;
    }
  }
  return closest;
}

/**
 * Calculate price in UZS using the cost formula.
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
 */
export function guessWeightKg(title, subtype) {
  const text = `${title || ''} ${subtype || ''}`.toLowerCase();
  for (const [key, w] of Object.entries(DEFAULT_WEIGHT_BY_TYPE)) {
    if (text.includes(key)) return w;
  }
  return 0.8;
}

/**
 * Build the system prompt for Gemini with real product examples (few-shot learning).
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

  const categoryList = (categories || [])
    .map((c) => `"${c.slug?.current || c.slug}" → ${c.title}`)
    .join(', ');

  const styleList = (styles || [])
    .map((s) => `"${s.slug?.current || s.slug}" → ${s.title}`)
    .join(', ');

  const brandList = (brands || [])
    .map((b) => `"${b.slug?.current || b.slug}" → ${b.title}`)
    .join(', ');

  let examplesBlock = '';
  if (exampleProducts.length > 0) {
    examplesBlock = '\n\n=== ПРИМЕРЫ ЗАПОЛНЕННЫХ ТОВАРОВ (делай точно в таком формате) ===\n' +
      exampleProducts
        .map(
          (p, i) =>
            `Пример ${i + 1}:\n` +
            `  title: "${p.title}"\n` +
            `  description: "${(p.description || '').replace(/\n/g, '\\n')}"\n` +
            `  subtype: "${p.subtype || ''}"\n` +
            `  category: "${p.categorySlug || p.category || ''}"\n` +
            `  style: "${p.styleSlug || p.style || ''}"\n` +
            `  brand: "${p.brandSlug || p.brand || ''}"\n` +
            `  colors: [${(Array.isArray(p.colors) ? p.colors : []).map((c) => `"${c}"`).join(', ')}]\n` +
            `  price: ${p.price || 'N/A'}`
        )
        .join('\n\n');
  }

  return `Ты — профессиональный баер, эксперт по стритвир-одежде и копирайтер. Твоя задача: по фотографиям товара с фабрики (Yupoo) и данным ниже составить идеальную карточку товара для магазина в Ташкенте и рассчитать бизнес-модель продажи.

ДАННЫЕ С САЙТА ПОСТАВЩИКА:
- Краткое название: ${title || 'не указано'}
- Цена поставщика (юани): ${priceYuan ?? 'не указано'}
- Бренд: ${brandName || 'не указано'}

ДОПУСТИМЫЕ ЗНАЧЕНИЯ (выбирай СТРОГО из этих списков):
- categorySlug: ${categoryList || 'нет данных'}
- styleSlug: ${styleList || 'нет данных'}
- brandSlug: ${brandList || 'нет данных'}

ПРАВИЛА ЗАПОЛНЕНИЯ:

1. **title**: Англоязычное название (например: "Syna World x Nemz Rent's Due Hoodie — Black/Pink"). СТРОГО: НЕ используй иконки, звезды (★), эмодзи или другие декоративные символы. Название должно быть чистым текстом.

2. **description**: ТОЛЬКО текст для ПОКУПАТЕЛЯ (он это увидит в магазине!). НЕ включай цену, математику, прибыль. Сохраняй переносы строк (\\n). Формат:
[Краткое описание товара в 1-2 предложения на русском]\\n\\nВес: [N] грамм.\\nТкань: [Материал, состав].\\nДетали: [Принты, логотипы, молнии, карманы].\\nКрой: [Oversize / Boxy Fit / Regular / Slim].
Если на фото или в названии ЯВНО видна информация о параметрах модели (например "170cm 60kg wears M", "im 165cm 50kg", "модель 170 см") — добавь в конце описания строку: \\nМодель: [рост] см, [вес] кг, размер [S/M/L/XL]. СТРОГО: если такой информации нет — не добавляй эту строку и не придумывай параметры.

3. **internalNotes**: Скрытые заметки для МЕНЕДЖЕРА (покупатель НЕ увидит). Сохраняй переносы строк (\\n). Формат:
Закуп: [цена]¥ / 6.5 = $[сумма]\\nДоставка (Авиа): [вес] кг × 10 = $[сумма]\\nУпаковка/Сервис: $1.50\\nСебестоимость: $[итого] (~[итого × 12000] сум)\\n\\nЦена продажи: [priceUzs] сум\\nПрибыль (Rookie): ~[выручка - себестоимость] сум\\nПрибыль (Legend): ~[выручка - себестоимость - кешбэк 7% - 50000] сум ($[в долларах])

4. **subtype**: Тип товара на русском. 
   - Сначала попробуй выбрать из этого списка: Худи, Зипки, Свитшоты, Футболки, Лонгсливы, Рубашки, Поло, Джинсы, Штаны, Брюки, Шорты, Джорты, Куртки, Пуховики, Ветровки, Бомберы, Жилеты, Кроссовки, Кеды, Ботинки, Тапочки, Кепки, Шапки, Сумки, Рюкзаки, Кабели, Ремни.
   - Если товар СОВСЕМ не подходит (например, "Галстук" или "Носки"), ты можешь придумать новый подтип одной фразой.
   - СТРОГО: НЕ создавай новые названия для того, что УЖЕ есть в списке (например, нельзя писать "Зип-худи" или "Кофта на замке", если есть "Зипки").
5. **categorySlug/styleSlug/brandSlug**: Выбирай строго из допустимых списков.
6. **colors**: Массив цветов на английском (например ["Black", "Pink"]). Распознай по фото.
7. **keywords**: 5–15 слов и коротких фраз на русском и английском для поиска товара. Включай: тип товара (на обоих языках), материал (cotton, хлопок), бренд, название коллекции или принта, цвет, стиль (streetwear, oversize, graphic, uk-trap и т.д.), сезон если применимо. Пример: ["худи", "hoodie", "оверсайз", "oversize", "хлопок", "cotton", "флисовый принт", "Denim Tears", "streetwear", "осень"].
9. **excludeImageIndices**: Массив индексов (начиная с 0) фотографий, которые НУЖНО ИСКЛЮЧИТЬ (удалить).

   ПРАВИЛО ФИЛЬТРАЦИИ — ИСКЛЮЧАЙ следующие типы фото:
   - Фото, на которых китайские иероглифы или цифры нанесены ПОВЕРХ изображения как подписи или цветовые метки (например: цветные надписи «1白色», «2粉色», «3橙色» и т.п. прямо на ряду одежды на вешалках — это каталог расцветок с наложенными текстовыми метками).
   - Фото-таблицы размеров (size chart) — изображение, которое целиком является таблицей или схемой с текстом, цифрами, измерениями тела.

   ВАЖНО: ВСЕ ОСТАЛЬНЫЕ фото ОСТАВЛЯЙ (индекс НЕ добавляем в массив). В том числе:
   - Оставляй фото с несколькими вещами разных расцветок, если на них НЕТ наложенных текстовых меток поверх фото.
   - Оставляй фото где иероглифы видны только как часть бирки, тега, логотипа или упаковки (не наложены искусственно поверх фото).
   - Оставляй любые предметные фото без людей и без наложенного текста.

   Если нет фото для исключения, верни пустой массив [].
${examplesBlock}

ВЕРНИ ТОЛЬКО VALID JSON с полями: title, description, internalNotes, subtype, categorySlug, styleSlug, brandSlug, colors, keywords, priceUzs, weightKg, markup, excludeImageIndices.`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Build image parts for Gemini request (supports multiple images).
 * @param {string[]} imagesBase64 - Array of base64-encoded images
 * @returns {Array} Parts array for Gemini API
 */
function buildImageParts(imagesBase64) {
  return imagesBase64.map((data) => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data,
    },
  }));
}

/**
 * Call Gemini API with images (base64) and prompt; return parsed JSON or null.
 * v2: supports multiple images, uses gemini-2.0-flash, response_schema for strict JSON.
 *
 * @param {object} params
 * @param {string} [params.imageBase64] - Single image (backward compat)
 * @param {string[]} [params.imagesBase64] - Multiple images (preferred, up to 4)
 * @param {string} params.title - Raw title from Yupoo
 * @param {number} [params.priceYuan] - Price in CNY
 * @param {string} [params.brandName] - Brand title
 * @param {Array} [params.categories]
 * @param {Array} [params.styles]
 * @param {Array} [params.brands]
 * @param {Array} [params.exampleProducts] - Real published products from Sanity
 * @param {string[]} [params.apiKeys] - Multiple Gemini API keys
 * @returns {Promise<object|null>}
 */
export async function callGeminiForProduct(params) {
  const {
    imageBase64,
    imagesBase64: imagesParam,
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

  // Build images array: prefer imagesBase64 (multiple), fallback to single imageBase64
  const imagesBase64 = Array.isArray(imagesParam) && imagesParam.length > 0
    ? imagesParam.slice(0, 10) // Increased to 10 images for better filtering
    : imageBase64
      ? [imageBase64]
      : [];

  if (imagesBase64.length === 0) return null;

  const prompt = buildPrompt({
    title,
    priceYuan,
    brandName,
    categories,
    styles,
    brands,
    exampleProducts: exampleProducts || [],
  });

  const imageParts = buildImageParts(imagesBase64);

  const body = {
    contents: [
      {
        parts: [
          ...imageParts,
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Product title in English' },
          description: { type: 'string', description: 'Customer-facing product description in Russian (NO prices, NO math)' },
          internalNotes: { type: 'string', description: 'Internal notes for manager: cost breakdown, profit margins' },
          subtype: { type: 'string', description: 'Product subtype in Russian' },
          categorySlug: { type: 'string', description: 'Category slug from allowed list' },
          styleSlug: { type: 'string', description: 'Style slug from allowed list' },
          brandSlug: { type: 'string', description: 'Brand slug from allowed list' },
          colors: { type: 'array', items: { type: 'string' }, description: 'Colors in English' },
          keywords: { type: 'array', items: { type: 'string' }, description: '5-15 keywords in Russian and English for search' },
          priceUzs: { type: 'number', description: 'Calculated sale price in UZS' },
          weightKg: { type: 'number', description: 'Estimated weight in kg' },
          markup: { type: 'number', description: 'Markup coefficient used (1.8-2.1)' },
          excludeImageIndices: { type: 'array', items: { type: 'number' }, description: 'Indices of images provided that should be excluded (models, charts, etc)' },
        },
        required: ['title', 'description', 'internalNotes', 'subtype', 'categorySlug', 'styleSlug', 'brandSlug', 'colors', 'keywords', 'priceUzs', 'weightKg', 'markup', 'excludeImageIndices'],
      },
      temperature: 0.1,
    },
  };

  let lastError = null;
  for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
    const key = apiKeys[keyIndex];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${key}`;
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
        const result = JSON.parse(raw);
        if (result && result.subtype != null) result.subtype = normalizeSubtype(result.subtype);
        return result;
      }
      const isQuota = res.status === 429;
      const isOverload = res.status === 503;
      lastError = new Error(`Gemini API ${res.status}: ${errText.slice(0, 150)}`);
      if (isOverload) {
        // 503 = server overload — retry this key up to 2 more times with back-off
        let retried = false;
        for (let r = 1; r <= 2; r++) {
          const wait = r * 15000;
          console.error(`Gemini key ${keyIndex + 1}/${apiKeys.length} overloaded (503), retry ${r}/2 in ${wait / 1000}s...`);
          await sleep(wait);
          const r2 = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          if (r2.ok) {
            const data = JSON.parse(await r2.text());
            const text2 = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text2) {
              let raw2 = text2.trim();
              if (raw2.startsWith('```')) raw2 = raw2.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
              const result = JSON.parse(raw2);
              if (result && result.subtype != null) result.subtype = normalizeSubtype(result.subtype);
              return result;
            }
          }
          if (r2.status !== 503) break; // different error — stop retrying this key
        }
        // after retries, try next key
        if (keyIndex < apiKeys.length - 1) {
          await sleep(3000);
          continue;
        }
      } else if (isQuota && keyIndex < apiKeys.length - 1) {
        if (apiKeys.length > 1) {
          console.error(`Gemini key ${keyIndex + 1}/${apiKeys.length} quota, trying next key in 3s...`);
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
