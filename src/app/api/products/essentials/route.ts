import { NextResponse } from "next/server";
import { findEssentials } from "@backend/repositories/product-repository";

export async function GET() {
  const products = await findEssentials();
  return NextResponse.json(products);
}
