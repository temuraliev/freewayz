import { NextRequest, NextResponse } from "next/server";
import { findDistinctSubtypes } from "@backend/repositories/product-repository";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const subtypes = await findDistinctSubtypes({
    style: params.get("style") || undefined,
    brand: params.get("brand") || undefined,
    category: params.get("category") || undefined,
    saleOnly: params.get("saleOnly") === "true",
    minPrice: params.has("minPrice") ? Number(params.get("minPrice")) : undefined,
    maxPrice: params.has("maxPrice") ? Number(params.get("maxPrice")) : undefined,
  });

  return NextResponse.json(subtypes);
}
