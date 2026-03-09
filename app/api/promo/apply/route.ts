import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import groq from "groq";
import { validateUserInitData } from "@/lib/validate-user";

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_TOKEN!,
  useCdn: false,
});

interface PromoDoc {
  _id: string;
  code: string;
  type: "discount_percent" | "discount_fixed" | "balance_topup";
  value: number;
  minOrderTotal?: number;
  maxUses?: number;
  usedCount: number;
  maxUsesPerUser: number;
  usedBy?: { telegramId: string; usedAt: string }[];
  isActive: boolean;
  expiresAt?: string;
}

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
      return NextResponse.json(
        { error: "Промокод не указан" },
        { status: 400 }
      );
    }

    const upperCode = code.trim().toUpperCase();
    const telegramId = String(user.id);

    const promo = await sanity.fetch<PromoDoc | null>(
      groq`*[_type == "promoCode" && upper(code) == $code][0]{
        _id, code, type, value, minOrderTotal,
        maxUses, usedCount, maxUsesPerUser,
        usedBy[]{ telegramId, usedAt },
        isActive, expiresAt
      }`,
      { code: upperCode }
    );

    if (!promo) {
      return NextResponse.json(
        { error: "Промокод не найден" },
        { status: 404 }
      );
    }

    // Validations
    if (!promo.isActive) {
      return NextResponse.json(
        { error: "Промокод неактивен" },
        { status: 400 }
      );
    }

    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "Срок действия промокода истёк" },
        { status: 400 }
      );
    }

    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
      return NextResponse.json(
        { error: "Промокод исчерпан" },
        { status: 400 }
      );
    }

    const userUses = (promo.usedBy || []).filter(
      (u) => u.telegramId === telegramId
    ).length;
    if (userUses >= (promo.maxUsesPerUser || 1)) {
      return NextResponse.json(
        { error: "Вы уже использовали этот промокод" },
        { status: 400 }
      );
    }

    // Handle balance_topup immediately
    if (promo.type === "balance_topup") {
      const userDoc = await sanity.fetch<{ _id: string; cashbackBalance: number } | null>(
        groq`*[_type == "user" && telegramId == $telegramId][0]{ _id, cashbackBalance }`,
        { telegramId }
      );

      if (!userDoc) {
        return NextResponse.json(
          { error: "Пользователь не найден" },
          { status: 404 }
        );
      }

      const newBalance = (userDoc.cashbackBalance || 0) + promo.value;

      await sanity
        .patch(userDoc._id)
        .set({ cashbackBalance: newBalance })
        .commit();

      await sanity
        .patch(promo._id)
        .inc({ usedCount: 1 })
        .append("usedBy", [
          {
            _key: `${telegramId}_${Date.now()}`,
            telegramId,
            usedAt: new Date().toISOString(),
          },
        ])
        .commit();

      return NextResponse.json({
        ok: true,
        type: promo.type,
        value: promo.value,
        newBalance,
      });
    }

    // For discount codes, just validate and return the discount info.
    // Actual usage is recorded when the order is created.
    return NextResponse.json({
      ok: true,
      type: promo.type,
      value: promo.value,
      code: promo.code,
      minOrderTotal: promo.minOrderTotal,
    });
  } catch (err) {
    console.error("promo apply error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
