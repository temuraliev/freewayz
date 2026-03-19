import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import groq from "groq";
import { validateUserInitData } from "@/lib/validate-user";
import { prisma } from "@/lib/db";

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_TOKEN!,
  useCdn: true,
});

const PRODUCT_PROJECTION = `{
  _id,
  tier,
  title,
  slug,
  price,
  originalPrice,
  "images": images[0...2].asset->url,
  "category": category->{ _id, title, slug },
  "style": style->{ _id, title, slug },
  "brand": brand->{ _id, title, slug },
  subtype,
  isHotDrop,
  isOnSale,
  isNewArrival
}`;

const LIMIT = 20;

export async function GET(request: NextRequest) {
  try {
    const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
    const user = validateUserInitData(initData, request.headers.get("host"));

    let telegramId = request.nextUrl.searchParams.get("telegramId");
    if (user) telegramId = String(user.id);
    const productTier = request.nextUrl.searchParams.get("tier") || "ultimate";

    let products: unknown[] = [];
    let tier = 3;

    if (telegramId && telegramId !== "0") {
      const userDoc = await prisma.user.findUnique({
        where: { telegramId },
        select: {
          id: true,
          onboardingDone: true,
          preferredBrandIds: true,
          preferredStyleIds: true,
        },
      });

      if (userDoc) {
        // Fetch order history from Postgres
        const orders = await prisma.order.findMany({
          where: { userId: userDoc.id, status: { not: "cancelled" } },
          select: { items: true },
        });

        const purchasedIds = new Set<string>();
        const purchasedBrandSlugs = new Set<string>();
        for (const o of orders) {
          const items = o.items as { productId?: string; brand?: string }[];
          for (const item of items || []) {
            if (item.productId) purchasedIds.add(item.productId);
            if (item.brand) purchasedBrandSlugs.add(item.brand.toLowerCase());
          }
        }

        // Tier 1: user has orders — recommend from same brands
        if (purchasedIds.size > 0) {
          tier = 1;
          const excludeArr = Array.from(purchasedIds);
          const brandArr = Array.from(purchasedBrandSlugs);

          products = await sanity.fetch(
            groq`*[_type == "product" && tier == $productTier && !(_id in $excludeIds) && brand->slug.current in $brands]
              | order(_createdAt desc) [0...$limit] ${PRODUCT_PROJECTION}`,
            { excludeIds: excludeArr, brands: brandArr, limit: LIMIT, productTier }
          );
        }

        // Tier 2: has preferences but not enough order-based results
        if (
          products.length < LIMIT &&
          userDoc.onboardingDone &&
          ((userDoc.preferredBrandIds?.length || 0) > 0 ||
            (userDoc.preferredStyleIds?.length || 0) > 0)
        ) {
          tier = products.length === 0 ? 2 : tier;
          const existingIds = new Set((products as { _id: string }[]).map((p) => p._id));
          const remaining = LIMIT - products.length;

          const prefProducts = await sanity.fetch(
            groq`*[_type == "product" && tier == $productTier && !(_id in $excludeIds) && (
              brand._ref in $brandIds || style._ref in $styleIds
            )] | order(_createdAt desc) [0...$remaining] ${PRODUCT_PROJECTION}`,
            {
              excludeIds: Array.from(new Set([...Array.from(purchasedIds), ...Array.from(existingIds)])),
              brandIds: userDoc.preferredBrandIds,
              styleIds: userDoc.preferredStyleIds,
              remaining,
              productTier,
            }
          );

          products = [
            ...products,
            ...(prefProducts as unknown[]).filter(
              (p) => !existingIds.has((p as { _id: string })._id)
            ),
          ].slice(0, LIMIT);
        }
      }
    }

    // Tier 3: new user / not enough results — curated mix
    if (products.length < LIMIT) {
      tier = products.length === 0 ? 3 : tier;
      const existingIds = (products as { _id: string }[]).map((p) => p._id);
      const needed = LIMIT - products.length;

      const hot = await sanity.fetch(
        groq`*[_type == "product" && tier == $productTier && isHotDrop == true && !(_id in $ex)]
          | order(_createdAt desc) [0...7] ${PRODUCT_PROJECTION}`,
        { ex: existingIds, productTier }
      );

      const fresh = await sanity.fetch(
        groq`*[_type == "product" && tier == $productTier && isNewArrival == true && !(_id in $ex)]
          | order(_createdAt desc) [0...7] ${PRODUCT_PROJECTION}`,
        { ex: [...existingIds, ...(hot as { _id: string }[]).map((p) => p._id)], productTier }
      );

      const sale = await sanity.fetch(
        groq`*[_type == "product" && tier == $productTier && isOnSale == true && !(_id in $ex)]
          | order(_createdAt desc) [0...6] ${PRODUCT_PROJECTION}`,
        {
          ex: [
            ...existingIds,
            ...(hot as { _id: string }[]).map((p) => p._id),
            ...(fresh as { _id: string }[]).map((p) => p._id),
          ],
          productTier,
        }
      );

      const filler = [
        ...(hot as unknown[]),
        ...(fresh as unknown[]),
        ...(sale as unknown[]),
      ].slice(0, needed);

      products = [...products, ...filler].slice(0, LIMIT);
    }

    return NextResponse.json({ products, tier });
  } catch (err) {
    console.error("recommendations error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
