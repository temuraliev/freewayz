import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@backend/db";
import { validateUserInitData } from "@backend/auth/validate-user";
import { syncCart } from "@backend/services/cart-service";
import {
  withErrorHandler,
  UnauthorizedError,
  ValidationError,
} from "@backend/middleware/with-error-handler";

const cartItemSchema = z.object({
  productId: z.string().min(1),
  size: z.string().optional(),
  color: z.string().nullable().optional(),
  quantity: z.number().int().min(1).max(100),
  price: z.number().nonnegative().optional(),
  title: z.string().optional(),
});

const bodySchema = z.object({
  initData: z.string().min(1),
  cartItems: z.array(cartItemSchema).max(100),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid cart payload");
  }

  const userData = validateUserInitData(parsed.data.initData, req.headers.get("host"));
  if (!userData || !userData.id) {
    throw new UnauthorizedError("Invalid initData");
  }

  const telegramId = String(userData.id);

  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ success: true, message: "User not found, skipping sync" });
  }

  const hasItems = parsed.data.cartItems.length > 0;
  const cartItemsStr = hasItems ? JSON.stringify(parsed.data.cartItems) : null;
  const cartUpdatedAt = hasItems ? new Date() : null;

  // Write to both legacy JSON field and new CartItem model
  // (legacy will be removed once the new model is verified in production)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      cartItems: cartItemsStr,
      cartUpdatedAt,
      abandonedCartNotified: false,
    },
  });

  // Sync to new CartItem table — non-blocking, errors don't fail the request
  try {
    await syncCart(
      user.id,
      parsed.data.cartItems.map((it) => ({
        productId: it.productId,
        title: it.title,
        size: it.size || "One Size",
        color: it.color,
        price: it.price ?? 0,
        quantity: it.quantity,
      }))
    );
  } catch (err) {
    console.error("CartItem sync failed (legacy data still saved):", err);
  }

  return NextResponse.json({ success: true });
});
