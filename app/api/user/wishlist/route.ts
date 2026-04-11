import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@backend/db";
import { validateUserInitData } from "@backend/auth/validate-user";
import {
  withErrorHandler,
  UnauthorizedError,
  ValidationError,
} from "@backend/middleware/with-error-handler";

/**
 * GET /api/user/wishlist — list items
 * POST /api/user/wishlist — add item
 * DELETE /api/user/wishlist?productId=X — remove item
 */

export const GET = withErrorHandler(async (request: NextRequest) => {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const user = validateUserInitData(initData, request.headers.get("host"));
  if (!user) return NextResponse.json({ items: [] });

  const userDoc = await prisma.user.findUnique({
    where: { telegramId: String(user.id) },
    select: { id: true },
  });
  if (!userDoc) return NextResponse.json({ items: [] });

  const items = await prisma.wishlistItem.findMany({
    where: { userId: userDoc.id },
    orderBy: { addedAt: "desc" },
  });

  return NextResponse.json({ items });
});

const addSchema = z.object({
  initData: z.string().min(1),
  productId: z.string().min(1),
  title: z.string().optional(),
  brand: z.string().optional(),
  price: z.number().nonnegative().optional(),
  imageUrl: z.string().optional(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid wishlist payload");

  const user = validateUserInitData(parsed.data.initData, request.headers.get("host"));
  if (!user) throw new UnauthorizedError();

  const userDoc = await prisma.user.findUnique({
    where: { telegramId: String(user.id) },
    select: { id: true },
  });
  if (!userDoc) throw new UnauthorizedError("User not found");

  // Upsert: idempotent add
  await prisma.wishlistItem.upsert({
    where: {
      userId_productId: { userId: userDoc.id, productId: parsed.data.productId },
    },
    update: {
      title: parsed.data.title ?? null,
      brand: parsed.data.brand ?? null,
      price: parsed.data.price ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
    },
    create: {
      userId: userDoc.id,
      productId: parsed.data.productId,
      title: parsed.data.title ?? null,
      brand: parsed.data.brand ?? null,
      price: parsed.data.price ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
    },
  });

  return NextResponse.json({ ok: true });
});

export const DELETE = withErrorHandler(async (request: NextRequest) => {
  const productId = request.nextUrl.searchParams.get("productId");
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";

  if (!productId) throw new ValidationError("productId is required");

  const user = validateUserInitData(initData, request.headers.get("host"));
  if (!user) throw new UnauthorizedError();

  const userDoc = await prisma.user.findUnique({
    where: { telegramId: String(user.id) },
    select: { id: true },
  });
  if (!userDoc) throw new UnauthorizedError("User not found");

  await prisma.wishlistItem.deleteMany({
    where: { userId: userDoc.id, productId },
  });

  return NextResponse.json({ ok: true });
});
