import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import { validateTelegramInitData } from "@/lib/telegram-auth";
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
});

function makeSanityClient() {
  const token = process.env.SANITY_API_TOKEN;
  if (!token) return null;
  return createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
    apiVersion: "2024-01-01",
    useCdn: false,
    token,
  });
}

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

  const client = makeSanityClient();
  if (!client) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  try {
    let userDoc = await client.fetch(
      `*[_type == "user" && telegramId == $tid][0]{ _id }`,
      { tid: String(tgUser.id) }
    );
    if (!userDoc) {
      userDoc = await client.create({
        _type: "user",
        telegramId: String(tgUser.id),
        username: tgUser.username || "",
        firstName: tgUser.first_name,
        status: "ROOKIE",
        totalSpent: 0,
        cashbackBalance: 0,
      });
    }

    const orderId = `${Date.now().toString(36).toUpperCase()}`;
    const items = parsed.data.items.map((it) => ({
      _key: `k${Math.random().toString(36).slice(2, 8)}`,
      _type: "orderItem" as const,
      productId: it.productId,
      title: it.title,
      brand: it.brand,
      size: it.size,
      color: it.color,
      price: it.price,
      quantity: it.quantity,
    }));

    const orderDoc: Record<string, unknown> = {
      _type: "order",
      orderId,
      user: { _type: "reference", _ref: userDoc._id },
      items,
      total: parsed.data.total,
      status: "new",
      createdAt: new Date().toISOString(),
    };

    if (parsed.data.promoCode) orderDoc.promoCode = parsed.data.promoCode;
    if (parsed.data.discount) orderDoc.discount = parsed.data.discount;

    await client.create(orderDoc);

    // Record promo code usage if applied
    if (parsed.data.promoCode) {
      try {
        const promo = await client.fetch(
          `*[_type == "promoCode" && upper(code) == $code][0]{ _id }`,
          { code: parsed.data.promoCode.trim().toUpperCase() }
        );
        if (promo) {
          await client
            .patch(promo._id)
            .inc({ usedCount: 1 })
            .append("usedBy", [
              {
                _key: `${tgUser.id}_${Date.now()}`,
                telegramId: String(tgUser.id),
                usedAt: new Date().toISOString(),
              },
            ])
            .commit();
        }
      } catch (promoErr) {
        console.error("Failed to record promo usage:", promoErr);
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
