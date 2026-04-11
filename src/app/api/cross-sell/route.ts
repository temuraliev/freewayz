import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@backend/middleware/with-error-handler";
import {
  findCrossSell,
  findCrossSellFallback,
} from "@backend/repositories/product-repository";

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

const TARGET = 5;

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
  const exclude = (params.get("exclude") || "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter((n) => !isNaN(n));
  const maxPrice = Number(params.get("maxPrice")) || 99999999;

  const complementarySubtypes = new Set<string>();
  for (const st of subtypes) {
    const matches = CROSS_SELL_MAP[st];
    if (matches) matches.forEach((m) => complementarySubtypes.add(m));
  }

  let products = await findCrossSell(
    Array.from(complementarySubtypes),
    brands,
    exclude,
    maxPrice,
    TARGET
  );

  // Fallback: same brand, different subtype, cheaper
  if (products.length < TARGET && brands.length > 0) {
    const existingIds = [...exclude, ...products.map((p) => Number(p._id))];
    const remaining = TARGET - products.length;

    const fallback = await findCrossSellFallback(
      brands,
      subtypes,
      existingIds,
      maxPrice,
      remaining
    );

    products = [...products, ...fallback].slice(0, TARGET);
  }

  return NextResponse.json({ products });
});
