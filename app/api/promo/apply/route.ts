import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@backend/db";
import { validateUserInitData } from "@backend/auth/validate-user";
import {
  withErrorHandler,
  ApiError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from "@backend/middleware/with-error-handler";

const bodySchema = z.object({
  initData: z.string().min(1),
  code: z.string().min(1).max(64),
  context: z.enum(["cart", "profile"]).optional(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid promo payload");
  }

  const user = validateUserInitData(parsed.data.initData, request.headers.get("host"));
  if (!user) {
    throw new UnauthorizedError();
  }

  const upperCode = parsed.data.code.trim().toUpperCase();
  const telegramId = String(user.id);

  const promo = await prisma.promoCode.findUnique({
    where: { code: upperCode },
    include: {
      usedBy: {
        include: { user: { select: { telegramId: true } } },
      },
    },
  });

  if (!promo) throw new NotFoundError("Промокод не найден");
  if (!promo.isActive) throw new ApiError("Промокод неактивен", 400, "PROMO_INACTIVE");
  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
    throw new ApiError("Срок действия промокода истёк", 400, "PROMO_EXPIRED");
  }
  if (promo.maxUses && promo.usedCount >= promo.maxUses) {
    throw new ApiError("Промокод исчерпан", 400, "PROMO_EXHAUSTED");
  }

  const userUses = promo.usedBy.filter((u) => u.user.telegramId === telegramId).length;
  if (userUses >= (promo.maxUsesPerUser || 1)) {
    throw new ApiError("Вы уже использовали этот промокод", 400, "PROMO_ALREADY_USED");
  }

  // Handle balance_topup immediately
  if (promo.type === "balance_topup") {
    const userDoc = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true, cashbackBalance: true },
    });

    if (!userDoc) throw new NotFoundError("Пользователь не найден");

    const newBalance = (userDoc.cashbackBalance || 0) + promo.value;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userDoc.id },
        data: { cashbackBalance: newBalance },
      }),
      prisma.promoCode.update({
        where: { id: promo.id },
        data: { usedCount: { increment: 1 } },
      }),
      prisma.promoUsage.create({
        data: { promoCodeId: promo.id, userId: userDoc.id },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      type: promo.type,
      value: promo.value,
      newBalance,
    });
  }

  // For discount codes — return info, actual usage recorded on order creation
  return NextResponse.json({
    ok: true,
    type: promo.type,
    value: promo.value,
    code: promo.code,
    minOrderTotal: promo.minOrderTotal,
  });
});
