import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateUserInitData } from "@/lib/validate-user";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { initData, code, context } = body as {
      initData?: string;
      code?: string;
      context?: "cart" | "profile";
    };

    const user = validateUserInitData(
      initData ?? "",
      request.headers.get("host")
    );
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Промокод не указан" }, { status: 400 });
    }

    const upperCode = code.trim().toUpperCase();
    const telegramId = String(user.id);

    const promo = await prisma.promoCode.findUnique({
      where: { code: upperCode },
      include: {
        usedBy: {
          include: { user: { select: { telegramId: true } } },
        },
      },
    });

    if (!promo) {
      return NextResponse.json({ error: "Промокод не найден" }, { status: 404 });
    }

    if (!promo.isActive) {
      return NextResponse.json({ error: "Промокод неактивен" }, { status: 400 });
    }

    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Срок действия промокода истёк" }, { status: 400 });
    }

    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
      return NextResponse.json({ error: "Промокод исчерпан" }, { status: 400 });
    }

    const userUses = promo.usedBy.filter((u) => u.user.telegramId === telegramId).length;
    if (userUses >= (promo.maxUsesPerUser || 1)) {
      return NextResponse.json({ error: "Вы уже использовали этот промокод" }, { status: 400 });
    }

    // Handle balance_topup immediately
    if (promo.type === "balance_topup") {
      const userDoc = await prisma.user.findUnique({
        where: { telegramId },
        select: { id: true, cashbackBalance: true },
      });

      if (!userDoc) {
        return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
      }

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

    // For discount codes, validate and return discount info.
    // Actual usage is recorded when the order is created.
    void context; // context not needed for Prisma flow
    return NextResponse.json({
      ok: true,
      type: promo.type,
      value: promo.value,
      code: promo.code,
      minOrderTotal: promo.minOrderTotal,
    });
  } catch (err) {
    console.error("promo apply error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
