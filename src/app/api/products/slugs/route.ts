import { NextResponse } from "next/server";
import { findAllSlugs } from "@backend/repositories/product-repository";

export async function GET() {
  const slugs = await findAllSlugs();
  return NextResponse.json({ slugs });
}
