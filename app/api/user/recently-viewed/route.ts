import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import groq from "groq";
import { prisma } from "@backend/db";
import { validateUserInitData } from "@backend/auth/validate-user";
import { withErrorHandler } from "@backend/middleware/with-error-handler";

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  useCdn: true,
});

const PROJECTION = `{
  _id,
  title,
  slug,
  price,
  originalPrice,
  "images": images[0...2].asset->url,
  "brand": brand->{ _id, title, slug },
  "style": style->{ _id, title, slug },
  subtype,
  isHotDrop,
  isOnSale,
  isNewArrival
}`;

const LIMIT = 12;

export const GET = withErrorHandler(async (request: NextRequest) => {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const user = validateUserInitData(initData, request.headers.get("host"));
  if (!user) {
    return NextResponse.json({ products: [] });
  }

  const userDoc = await prisma.user.findUnique({
    where: { telegramId: String(user.id) },
    select: { id: true },
  });
  if (!userDoc) {
    return NextResponse.json({ products: [] });
  }

  // Get distinct most recent product IDs
  const views = await prisma.productView.findMany({
    where: { userId: userDoc.id },
    orderBy: { viewedAt: "desc" },
    select: { productId: true },
    take: LIMIT * 3, // over-fetch to dedupe
    distinct: ["productId"],
  });

  const ids = views.map((v) => v.productId).slice(0, LIMIT);
  if (ids.length === 0) {
    return NextResponse.json({ products: [] });
  }

  const products = await sanity.fetch(
    groq`*[_type == "product" && _id in $ids] ${PROJECTION}`,
    { ids }
  );

  // Preserve view order
  const productMap = new Map<string, unknown>();
  for (const p of (products as { _id: string }[]) ?? []) {
    productMap.set(p._id, p);
  }
  const ordered = ids.map((id) => productMap.get(id)).filter(Boolean);

  return NextResponse.json({ products: ordered });
});
