/**
 * Build Sanity GROQ match patterns from user search input.
 * - Stems Russian words (футболка → футболк) so "футболки", "Футболка" match.
 * - Adds English synonyms for common Russian terms so "футболка" finds "T-Shirt" etc.
 */

const RUSSIAN_VOWELS = new Set("аеиоуыэюяё");
const RUSSIAN_LETTER = /[а-яё]/i;

/** Short Russian word stem: drop last char if vowel (to match футболка/футболки). */
function stemRussian(word: string): string {
  const w = word.trim();
  if (w.length <= 2) return w;
  const last = w[w.length - 1]!.toLowerCase();
  if (RUSSIAN_VOWELS.has(last) && RUSSIAN_LETTER.test(w)) {
    return w.slice(0, -1);
  }
  return w;
}

/** Map Russian search term → extra English patterns for synonym search. */
const RU_EN_SYNONYMS: Record<string, string[]> = {
  футболка: ["t-shirt", "tee", "t shirt", "tshirt", "футболки"],
  футболки: ["t-shirt", "tee", "футболка"],
  худи: ["hoodie", "hoodies"],
  худишко: ["hoodie"],
  свитшот: ["sweatshirt", "sweat shirt"],
  свитшоты: ["sweatshirt", "sweatshirts"],
  джинсы: ["jeans", "джинс"],
  джинс: ["jeans", "джинсы"],
  куртка: ["jacket", "jackets", "куртки"],
  куртки: ["jacket", "jackets", "куртка"],
  ветровка: ["windbreaker", "windbreakers", "ветровки"],
  шорты: ["shorts", "шорт"],
  кроссовки: ["sneakers", "sneaker", "кроссовк"],
  кроссовк: ["sneakers", "sneaker", "кроссовки"],
  майка: ["tee", "t-shirt", "tank", "майки"],
  майки: ["tee", "t-shirt", "майка"],
  зипки: ["zip", "zip hoodie", "зип"],
  зип: ["zip", "zip hoodie", "зипки"],
  толстовка: ["sweatshirt", "sweat", "толстовки"],
  толстовки: ["sweatshirt", "толстовка"],
  брюки: ["pants", "trousers", "брюк"],
  штаны: ["pants", "trousers", "штан"],
};

/**
 * Returns an array of GROQ match patterns (e.g. "*футболк*", "*t-shirt*").
 * Pass to searchProductsQuery as searchTerms so any pattern match returns the product.
 */
export function buildSearchTerms(query: string): string[] {
  const lower = query.trim().toLowerCase();
  if (!lower) return [];

  const words = lower.split(/\s+/).filter(Boolean);
  const patterns = new Set<string>();

  for (const word of words) {
    const stem = stemRussian(word);
    patterns.add(`*${stem}*`);
    patterns.add(`*${word}*`);
    const synonyms = RU_EN_SYNONYMS[word] ?? RU_EN_SYNONYMS[word.slice(0, -1)];
    if (synonyms) {
      for (const s of synonyms) patterns.add(`*${s}*`);
    }
  }

  return Array.from(patterns);
}
