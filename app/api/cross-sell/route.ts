import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import groq from "groq";
import { withErrorHandler } from "@backend/middleware/with-error-handler";

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  useCdn: true,
});

const CROSS_SELL_MAP: Record<string, string[]> = {
  кроссовки: ["носки", "шнурки", "сумки"],
  кеды: ["носки", "шнурки"],
  ботинки: ["носки"],
  лоферы: ["носки"],
  худи: ["штаны", "шапки", "шарфы"],
  зипки: ["штаны", "шапки"],
  футболка: ["шорты", "кепки", "сумки"],
  лонгслив: ["штаны", "шапки"],
  куртка: ["шапки", "перчатки", "шарфы"],
  жилетка: ["худи", "лонгслив"],
  штаны: ["ремни", "носки"],
  джинсы: ["ремни", "носки"],
  шорты: ["футболка", "кепки"],
};

const PROJECTION = `{
  _id,
  title,
  slug,
  price,
  originalPrice,
  "images": images[0...1].asset->url,
  "brand": brand->{ _id, title, slug },
  subtype,
  isOnSale
}`;

const TARGET = 5;

type SanityProduct = { _id: string };

export const GET = withErrorHandler(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const subtypes = (params.get("subtypes") || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const brands = (params.get("brands") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const exclude = (params.get("exclude") || "").split(",").filter(Boolean);
  const maxPrice = Number(params.get("maxPrice")) || 99999999;

  const complementarySubtypes = new Set<string>();
  for (const st of subtypes) {
    const matches = CROSS_SELL_MAP[st];
    if (matches) matches.forEach((m) => complementarySubtypes.add(m));
  }

  let products: SanityProduct[] = [];

  if (complementarySubtypes.size > 0) {
    products = await sanity.fetch<SanityProduct[]>(
      groq`*[_type == "product" && !(_id in $exclude) && lower(subtype) in $subtypes]
        | order(brand->slug.current in $brands desc, _createdAt desc)
        [0...$limit] ${PROJECTION}`,
      {
        exclude,
        subtypes: Array.from(complementarySubtypes),
        brands,
        limit: TARGET,
      }
    );
  }

  // Fallback: same brand, different subtype, cheaper
  if (products.length < TARGET && brands.length > 0) {
    const existingIds = [...exclude, ...products.map((p) => p._id)];
    const remaining = TARGET - products.length;

    const fallback = await sanity.fetch<SanityProduct[]>(
      groq`*[_type == "product" && !(_id in $exclude)
        && brand->slug.current in $brands
        && !(lower(subtype) in $cartSubtypes)
        && price <= $maxPrice
      ] | order(_createdAt desc) [0...$remaining] ${PROJECTION}`,
      {
        exclude: existingIds,
        brands,
        cartSubtypes: subtypes,
        maxPrice,
        remaining,
      }
    );

    products = [...products, ...fallback].slice(0, TARGET);
  }

  return NextResponse.json({ products });
});
