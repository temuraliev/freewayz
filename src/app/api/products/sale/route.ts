import { NextRequest, NextResponse } from "next/server";
import { findSale } from "@backend/repositories/product-repository";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const offset = Number(params.get("offset") || "0");
  const limit = Number(params.get("limit") || "20");

  const products = await findSale(offset, limit);
  return NextResponse.json(products);
}
