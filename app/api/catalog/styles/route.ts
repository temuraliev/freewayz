import { NextResponse } from "next/server";
import { findAllStyles } from "@backend/repositories/product-repository";

export async function GET() {
  const styles = await findAllStyles();
  return NextResponse.json(styles);
}
