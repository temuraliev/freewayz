import { NextResponse } from "next/server";
import { findAllCategories } from "@backend/repositories/product-repository";

export async function GET() {
  const categories = await findAllCategories();
  return NextResponse.json(categories);
}
