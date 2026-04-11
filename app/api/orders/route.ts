import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@backend/db";
import { validateTelegramInitData } from "@backend/auth/telegram-auth";
import { z } from "zod";

const itemSchema = z.object({
  productId: z.string().optional().default(""),
  title: z.string().min(1),
  brand: z.string().optional().default(""),
  size: z.string().optional().default("One Size"),
  color: z.string().optional().default(""),
  price: z.number().nonnegative(),
  quantity: z.number().int().min(1).default(1),
});

const bodySchema = z.object({
  initData: z.string().min(1),
  items: z.array(itemSchema).min(1),
  total: z.number().nonnegative(),
  promoCode: z.string().optional(),
  discount: z.number().nonnegative().optional(),
  idempotencyKey: z.string().optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const adminBotToken = (process.env.ADMIN_BOT_TOKEN || "").replace(/\r\n?|\n/g, "").trim();
  const customerBotToken = (process.env.BOT_TOKEN || "").replace(/\r\n?|\n/g, "").trim();

  let tgUser: { id: number; username?: string; first_name: string } | null = null;
  for (const tok of [customerBotToken, adminBotToken]) {
    if (!tok) continue;
    const result = validateTelegramInitData(parsed.data.initData, tok);
    if (result) {
      tgUser = result.user;
      break;
    }
  }

  if (!tgUser) {
    return NextResponse.json({ error: "Invalid initData" }, { status: 401 });
  }

  try {
    const telegramId = String(tgUser.id);

    const userDoc = await prisma.user.upsert({
      where: { telegramId },
      update: {},
      create: {
        telegramId,
        username: tgUser.username || null,
        firstName: tgUser.first_name,
      },
    });

    // Idempotency check: if the client sends the same key, return existing order
    const idempotencyKey = parsed.data.idempotencyKey || request.headers.get("X-Idempotency-Key");
    if (idempotencyKey) {
      const existing = await prisma.order.findUnique({
        where: { idempotencyKey },
        select: { orderId: true },
      });
      if (existing) {
        return NextResponse.json({ ok: true, orderId: existing.orderId });
      }
    }

    const orderId = `${Date.now().toString(36).toUpperCase()}`;
    const items = parsed.data.items.map((it) => ({
      productId: it.productId,
      title: it.title,
      brand: it.brand,
      size: it.size,
      color: it.color,
      price: it.price,
      quantity: it.quantity,
    }));

    await prisma.order.create({
      data: {
        orderId,
        userId: userDoc.id,
        items,
        total: parsed.data.total,
        status: "new",
        promoCode: parsed.data.promoCode ?? null,
        discount: parsed.data.discount ?? null,
        ...(idempotencyKey ? { idempotencyKey } : {}),
      },
    });

    // Record promo code usage if applied
    // Uses unique constraint on (promoCodeId, userId) to prevent race conditions
    if (parsed.data.promoCode) {
      try {
        const upperCode = parsed.data.promoCode.trim().toUpperCase();
        const promo = await prisma.promoCode.findUnique({ where: { code: upperCode } });
        if (promo) {
          await prisma.$transaction([
            prisma.promoCode.update({
              where: { id: promo.id },
              data: { usedCount: { increment: 1 } },
            }),
            prisma.promoUsage.create({
              data: { promoCodeId: promo.id, userId: userDoc.id },
            }),
          ]);
        }
      } catch (promoErr: unknown) {
        // P2002 = unique constraint violation = already used, which is fine
        const isPrismaUniqueError =
          promoErr && typeof promoErr === "object" && "code" in promoErr && promoErr.code === "P2002";
        if (!isPrismaUniqueError) {
          console.error("Failed to record promo usage:", promoErr);
        }
      }
    }

    const adminIds = (process.env.ADMIN_TELEGRAM_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const botToken = adminBotToken || customerBotToken;
    if (botToken && adminIds.length > 0) {
      const itemLines = parsed.data.items
        .map((it, i) => `  ${i + 1}. ${it.brand} ${it.title} — ${it.size}`)
        .join("\n");
      const promoLine = parsed.data.promoCode
        ? `\nПромокод: ${parsed.data.promoCode} (−${(parsed.data.discount || 0).toLocaleString()} UZS)`
        : "";
      const text =
        `Новый заказ #${orderId}\n` +
        `Клиент: @${tgUser.username || tgUser.first_name}\n` +
        `Товаров: ${parsed.data.items.length}\n` +
        `Сумма: ${parsed.data.total.toLocaleString()} UZS${promoLine}\n\n` +
        itemLines;

      for (const chatId of adminIds) {
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text }),
        }).catch((e) => console.error("Notify admin:", e));
      }
    }

    return NextResponse.json({ ok: true, orderId });
  } catch (e) {
    console.error("Order create error:", e);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}
