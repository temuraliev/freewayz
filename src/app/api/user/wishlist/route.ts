import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDataSource } from "@backend/data-source";
import { User } from "@backend/entities/User";
import { WishlistItemEntity } from "@backend/entities/WishlistItem";
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

  const ds = await getDataSource();
  const userRepo = ds.getRepository(User);
  const wishlistRepo = ds.getRepository(WishlistItemEntity);

  const userDoc = await userRepo.findOne({
    where: { telegramId: String(user.id) },
    select: { id: true },
  });
  if (!userDoc) return NextResponse.json({ items: [] });

  const items = await wishlistRepo.find({
    where: { userId: userDoc.id },
    order: { addedAt: "DESC" },
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

  const ds = await getDataSource();
  const userRepo = ds.getRepository(User);
  const wishlistRepo = ds.getRepository(WishlistItemEntity);

  const userDoc = await userRepo.findOne({
    where: { telegramId: String(user.id) },
    select: { id: true },
  });
  if (!userDoc) throw new UnauthorizedError("User not found");

  // Upsert: idempotent add
  const existing = await wishlistRepo.findOne({
    where: { userId: userDoc.id, productId: parsed.data.productId },
  });

  if (existing) {
    await wishlistRepo.update(existing.id, {
      title: parsed.data.title ?? null,
      brand: parsed.data.brand ?? null,
      price: parsed.data.price ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
    });
  } else {
    const item = wishlistRepo.create({
      userId: userDoc.id,
      productId: parsed.data.productId,
      title: parsed.data.title ?? null,
      brand: parsed.data.brand ?? null,
      price: parsed.data.price ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
    });
    await wishlistRepo.save(item);
  }

  return NextResponse.json({ ok: true });
});

export const DELETE = withErrorHandler(async (request: NextRequest) => {
  const productId = request.nextUrl.searchParams.get("productId");
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";

  if (!productId) throw new ValidationError("productId is required");

  const user = validateUserInitData(initData, request.headers.get("host"));
  if (!user) throw new UnauthorizedError();

  const ds = await getDataSource();
  const userRepo = ds.getRepository(User);
  const wishlistRepo = ds.getRepository(WishlistItemEntity);

  const userDoc = await userRepo.findOne({
    where: { telegramId: String(user.id) },
    select: { id: true },
  });
  if (!userDoc) throw new UnauthorizedError("User not found");

  await wishlistRepo.delete({ userId: userDoc.id, productId });

  return NextResponse.json({ ok: true });
});
