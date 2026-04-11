import { NextResponse } from "next/server";
import { findAllBrands } from "@backend/repositories/product-repository";

export async function GET() {
  const brands = await findAllBrands();
  return NextResponse.json(brands);
}
