import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDataSource } from "@backend/data-source";
import { User } from "@backend/entities/User";
import { PromoCode } from "@backend/entities/PromoCode";
import { PromoUsage } from "@backend/entities/PromoUsage";
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

  const ds = await getDataSource();
  const promoRepo = ds.getRepository(PromoCode);
  const promoUsageRepo = ds.getRepository(PromoUsage);
  const userRepo = ds.getRepository(User);

  const promo = await promoRepo.findOne({
    where: { code: upperCode },
    relations: ["usedBy", "usedBy.user"],
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
    const userDoc = await userRepo.findOne({
      where: { telegramId },
      select: { id: true, cashbackBalance: true },
    });

    if (!userDoc) throw new NotFoundError("Пользователь не найден");

    const newBalance = (userDoc.cashbackBalance || 0) + promo.value;

    await ds.transaction(async (manager) => {
      await manager.getRepository(User).update(userDoc.id, {
        cashbackBalance: newBalance,
      });
      await manager.getRepository(PromoCode).update(promo.id, {
        usedCount: () => "usedCount + 1",
      });
      const usage = manager.getRepository(PromoUsage).create({
        promoCodeId: promo.id,
        userId: userDoc.id,
      });
      await manager.getRepository(PromoUsage).save(usage);
    });

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
