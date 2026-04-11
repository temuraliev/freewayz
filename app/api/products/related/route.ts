import { NextRequest, NextResponse } from "next/server";
import { findRelated } from "@backend/repositories/product-repository";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const excludeId = Number(params.get("excludeId") || "0");
  const brandId = params.has("brandId") ? Number(params.get("brandId")) : null;
  const styleId = params.has("styleId") ? Number(params.get("styleId")) : null;
  const categoryId = params.has("categoryId") ? Number(params.get("categoryId")) : null;

  const products = await findRelated(excludeId, brandId, styleId, categoryId, 6);
  return NextResponse.json(products);
}
