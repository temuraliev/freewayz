import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@backend/repositories/product-repository";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || "";
  if (q.trim().length === 0) {
    return NextResponse.json([]);
  }

  const products = await searchProducts(q.trim(), 80);
  return NextResponse.json(products);
}
