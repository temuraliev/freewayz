import { NextRequest, NextResponse } from "next/server";
import { validateUserInitData } from "@backend/auth/validate-user";
import { getDataSource } from "@backend/data-source";
import { User } from "@backend/entities/User";
import { UserPreference } from "@backend/entities/UserPreference";
import { OrderEntity, OrderStatus } from "@backend/entities/Order";
import { ProductViewEntity } from "@backend/entities/ProductView";
import { Not } from "typeorm";
import { withErrorHandler } from "@backend/middleware/with-error-handler";
import {
  findByBrandSlugs,
  findByPreferenceIds,
  findHotDrops,
  findFreshArrivals,
  findSale,
} from "@backend/repositories/product-repository";

const LIMIT = 20;

type FrontendProduct = { _id: string };

export const GET = withErrorHandler(async (request: NextRequest) => {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const user = validateUserInitData(initData, request.headers.get("host"));

  let telegramId = request.nextUrl.searchParams.get("telegramId");
  if (user) telegramId = String(user.id);

  let products: FrontendProduct[] = [];
  let tier = 3;

  if (telegramId && telegramId !== "0") {
    const ds = await getDataSource();
    const userRepo = ds.getRepository(User);
    const prefRepo = ds.getRepository(UserPreference);
    const orderRepo = ds.getRepository(OrderEntity);
    const viewRepo = ds.getRepository(ProductViewEntity);

    const userDoc = await userRepo.findOne({
      where: { telegramId },
      select: {
        id: true,
        onboardingDone: true,
        preferredBrandIds: true,
        preferredStyleIds: true,
      },
    });

    if (userDoc) {
      const userPreferences = await prefRepo.find({
        where: { userId: userDoc.id },
        select: { preferenceType: true, externalId: true },
      });

      const normalizedBrandIds = userPreferences
        .filter((p) => p.preferenceType === "brand")
        .map((p) => p.externalId);
      const normalizedStyleIds = userPreferences
        .filter((p) => p.preferenceType === "style")
        .map((p) => p.externalId);
      const effectiveBrandIds = normalizedBrandIds.length > 0
        ? normalizedBrandIds
        : (userDoc.preferredBrandIds ?? []);
      const effectiveStyleIds = normalizedStyleIds.length > 0
        ? normalizedStyleIds
        : (userDoc.preferredStyleIds ?? []);

      const orders = await orderRepo.find({
        where: { userId: userDoc.id, status: Not("cancelled" as OrderStatus) },
        select: { items: true },
      });

      const purchasedIds = new Set<number>();
      const purchasedBrandSlugs = new Set<string>();
      for (const o of orders) {
        const items = o.items as { productId?: string; brand?: string }[];
        for (const item of items || []) {
          if (item.productId) purchasedIds.add(Number(item.productId));
          if (item.brand) purchasedBrandSlugs.add(item.brand.toLowerCase());
        }
      }

      const recentViews = await viewRepo.find({
        where: { userId: userDoc.id },
        order: { viewedAt: "DESC" },
        take: 50,
        select: { productId: true, brandSlug: true },
      });
      const viewedBrandSlugs = new Set<string>();
      const viewedProductIds = new Set<number>();
      for (const v of recentViews) {
        if (v.brandSlug) viewedBrandSlugs.add(v.brandSlug.toLowerCase());
        viewedProductIds.add(Number(v.productId));
      }

      // Tier 1: user has orders — recommend from same brands
      if (purchasedIds.size > 0) {
        tier = 1;
        const excludeIds = Array.from(purchasedIds);
        products = await findByBrandSlugs(
          Array.from(purchasedBrandSlugs),
          excludeIds,
          LIMIT
        );
      }

      // Tier 1.5: not enough orders — fall back to recently viewed brands
      if (products.length < LIMIT && viewedBrandSlugs.size > 0) {
        if (products.length === 0) tier = 1;
        const existingIds = new Set(products.map((p) => Number(p._id)));
        const remaining = LIMIT - products.length;
        const excludeIds = Array.from(
          new Set([...Array.from(purchasedIds), ...Array.from(viewedProductIds), ...Array.from(existingIds)])
        );

        const viewed = await findByBrandSlugs(
          Array.from(viewedBrandSlugs),
          excludeIds,
          remaining
        );

        products = [...products, ...viewed.filter((p) => !existingIds.has(Number(p._id)))].slice(0, LIMIT);
      }

      // Tier 2: has preferences but not enough results
      if (
        products.length < LIMIT &&
        userDoc.onboardingDone &&
        (effectiveBrandIds.length > 0 || effectiveStyleIds.length > 0)
      ) {
        tier = products.length === 0 ? 2 : tier;
        const existingIds = new Set(products.map((p) => Number(p._id)));
        const remaining = LIMIT - products.length;
        const excludeIds = Array.from(
          new Set([...Array.from(purchasedIds), ...Array.from(existingIds)])
        );

        const prefProducts = await findByPreferenceIds(
          effectiveBrandIds.map(Number),
          effectiveStyleIds.map(Number),
          excludeIds,
          remaining
        );

        products = [
          ...products,
          ...prefProducts.filter((p) => !existingIds.has(Number(p._id))),
        ].slice(0, LIMIT);
      }
    }
  }

  // Tier 3: new user / not enough results — curated mix
  if (products.length < LIMIT) {
    tier = products.length === 0 ? 3 : tier;
    const existingIds = new Set(products.map((p) => Number(p._id)));
    const needed = LIMIT - products.length;

    const [hot, fresh, sale] = await Promise.all([
      findHotDrops(0, 7),
      findFreshArrivals(0, 7),
      findSale(0, 6),
    ]);

    const seen = new Set(Array.from(existingIds));
    const filler: FrontendProduct[] = [];
    for (const p of [...hot, ...fresh, ...sale]) {
      const id = Number(p._id);
      if (!seen.has(id)) {
        filler.push(p);
        seen.add(id);
        if (filler.length >= needed) break;
      }
    }

    products = [...products, ...filler].slice(0, LIMIT);
  }

  return NextResponse.json({ products, tier });
});
