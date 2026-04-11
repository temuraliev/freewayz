import { NextRequest, NextResponse } from "next/server";
import { findByFilter } from "@backend/repositories/product-repository";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const { products, total } = await findByFilter({
    style: params.get("style") || undefined,
    brand: params.get("brand") || undefined,
    category: params.get("category") || undefined,
    subtype: params.get("subtype") || undefined,
    saleOnly: params.get("saleOnly") === "true",
    minPrice: params.has("minPrice") ? Number(params.get("minPrice")) : undefined,
    maxPrice: params.has("maxPrice") ? Number(params.get("maxPrice")) : undefined,
    offset: params.has("offset") ? Number(params.get("offset")) : 0,
    limit: params.has("limit") ? Number(params.get("limit")) : 20,
  });

  return NextResponse.json({ products, total });
}
