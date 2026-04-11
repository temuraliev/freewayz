import { Hono } from "hono";
import groq from "groq";
import { validateUserInitData } from "../lib/validate-user.js";
import { prisma } from "../lib/db.js";
import { sanityClient } from "../lib/sanity.js";

const app = new Hono();

const PRODUCT_PROJECTION = `{
  _id, title, slug, price, originalPrice,
  "images": images[0...2].asset->url,
  "category": category->{ _id, title, slug },
  "style": style->{ _id, title, slug },
  "brand": brand->{ _id, title, slug },
  subtype, isHotDrop, isOnSale, isNewArrival
}`;

const LIMIT = 20;
type SanityProduct = { _id: string };

app.get("/", async (c) => {
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  const user = validateUserInitData(initData, c.req.header("host"));

  let telegramId = c.req.query("telegramId");
  if (user) telegramId = String(user.id);

  let products: SanityProduct[] = [];
  let tier = 3;

  if (telegramId && telegramId !== "0") {
    const userDoc = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true, onboardingDone: true, preferredBrandIds: true, preferredStyleIds: true, userPreferences: { select: { preferenceType: true, externalId: true } } },
    });

    if (userDoc) {
      const normalizedBrandIds = userDoc.userPreferences.filter((p) => p.preferenceType === "brand").map((p) => p.externalId);
      const normalizedStyleIds = userDoc.userPreferences.filter((p) => p.preferenceType === "style").map((p) => p.externalId);
      const effectiveBrandIds = normalizedBrandIds.length > 0 ? normalizedBrandIds : (userDoc.preferredBrandIds ?? []);
      const effectiveStyleIds = normalizedStyleIds.length > 0 ? normalizedStyleIds : (userDoc.preferredStyleIds ?? []);

      const orders = await prisma.order.findMany({ where: { userId: userDoc.id, status: { not: "cancelled" } }, select: { items: true } });
      const purchasedIds = new Set<string>();
      const purchasedBrandSlugs = new Set<string>();
      for (const o of orders) {
        const items = o.items as { productId?: string; brand?: string }[];
        for (const item of items || []) {
          if (item.productId) purchasedIds.add(item.productId);
          if (item.brand) purchasedBrandSlugs.add(item.brand.toLowerCase());
        }
      }

      const recentViews = await prisma.productView.findMany({
        where: { userId: userDoc.id }, orderBy: { viewedAt: "desc" }, take: 50,
        select: { productId: true, brandSlug: true },
      });
      const viewedBrandSlugs = new Set<string>();
      const viewedProductIds = new Set<string>();
      for (const v of recentViews) {
        if (v.brandSlug) viewedBrandSlugs.add(v.brandSlug.toLowerCase());
        viewedProductIds.add(v.productId);
      }

      // Tier 1: orders-based
      if (purchasedIds.size > 0) {
        tier = 1;
        products = await sanityClient().fetch<SanityProduct[]>(
          groq`*[_type == "product" && !(_id in $excludeIds) && brand->slug.current in $brands] | order(_createdAt desc) [0...$limit] ${PRODUCT_PROJECTION}`,
          { excludeIds: Array.from(purchasedIds), brands: Array.from(purchasedBrandSlugs), limit: LIMIT }
        );
      }

      // Tier 1.5: viewed brands
      if (products.length < LIMIT && viewedBrandSlugs.size > 0) {
        if (products.length === 0) tier = 1;
        const existingIds = new Set(products.map((p) => p._id));
        const excludeIds = Array.from(new Set([...Array.from(purchasedIds), ...Array.from(viewedProductIds), ...Array.from(existingIds)]));
        const viewed = await sanityClient().fetch<SanityProduct[]>(
          groq`*[_type == "product" && !(_id in $excludeIds) && brand->slug.current in $brands] | order(_createdAt desc) [0...$remaining] ${PRODUCT_PROJECTION}`,
          { excludeIds, brands: Array.from(viewedBrandSlugs), remaining: LIMIT - products.length }
        );
        products = [...products, ...viewed.filter((p) => !existingIds.has(p._id))].slice(0, LIMIT);
      }

      // Tier 2: preferences
      if (products.length < LIMIT && userDoc.onboardingDone && (effectiveBrandIds.length > 0 || effectiveStyleIds.length > 0)) {
        tier = products.length === 0 ? 2 : tier;
        const existingIds = new Set(products.map((p) => p._id));
        const prefProducts = await sanityClient().fetch<SanityProduct[]>(
          groq`*[_type == "product" && !(_id in $excludeIds) && (brand._ref in $brandIds || style._ref in $styleIds)] | order(_createdAt desc) [0...$remaining] ${PRODUCT_PROJECTION}`,
          { excludeIds: Array.from(new Set([...Array.from(purchasedIds), ...Array.from(existingIds)])), brandIds: effectiveBrandIds, styleIds: effectiveStyleIds, remaining: LIMIT - products.length }
        );
        products = [...products, ...prefProducts.filter((p) => !existingIds.has(p._id))].slice(0, LIMIT);
      }
    }
  }

  // Tier 3: curated mix
  if (products.length < LIMIT) {
    tier = products.length === 0 ? 3 : tier;
    const existingIds = products.map((p) => p._id);
    const [hot, fresh, sale] = await Promise.all([
      sanityClient().fetch<SanityProduct[]>(groq`*[_type == "product" && isHotDrop == true && !(_id in $ex)] | order(_createdAt desc) [0...7] ${PRODUCT_PROJECTION}`, { ex: existingIds }),
      sanityClient().fetch<SanityProduct[]>(groq`*[_type == "product" && isNewArrival == true && !(_id in $ex)] | order(_createdAt desc) [0...7] ${PRODUCT_PROJECTION}`, { ex: existingIds }),
      sanityClient().fetch<SanityProduct[]>(groq`*[_type == "product" && isOnSale == true && !(_id in $ex)] | order(_createdAt desc) [0...6] ${PRODUCT_PROJECTION}`, { ex: existingIds }),
    ]);

    const seen = new Set(existingIds);
    const filler: SanityProduct[] = [];
    for (const p of [...hot, ...fresh, ...sale]) {
      if (!seen.has(p._id)) { filler.push(p); seen.add(p._id); if (filler.length >= LIMIT - products.length) break; }
    }
    products = [...products, ...filler].slice(0, LIMIT);
  }

  return c.json({ products, tier });
});

export { app as recommendationsRoutes };
