import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@backend/data-source";
import { User } from "@backend/entities/User";
import { OrderEntity, OrderStatus } from "@backend/entities/Order";
import { PromoCode } from "@backend/entities/PromoCode";
import { PromoUsage } from "@backend/entities/PromoUsage";
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
    const ds = await getDataSource();
    const userRepo = ds.getRepository(User);
    const orderRepo = ds.getRepository(OrderEntity);
    const promoRepo = ds.getRepository(PromoCode);
    const promoUsageRepo = ds.getRepository(PromoUsage);

    const telegramId = String(tgUser.id);

    // Upsert user: find or create
    let userDoc = await userRepo.findOne({ where: { telegramId } });
    if (!userDoc) {
      userDoc = userRepo.create({
        telegramId,
        username: tgUser.username || null,
        firstName: tgUser.first_name,
      });
      userDoc = await userRepo.save(userDoc);
    }

    // Idempotency check: if the client sends the same key, return existing order
    const idempotencyKey = parsed.data.idempotencyKey || request.headers.get("X-Idempotency-Key");
    if (idempotencyKey) {
      const existing = await orderRepo.findOne({
        where: { idempotencyKey },
        select: { id: true, orderId: true },
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

    const newOrder = orderRepo.create({
      orderId,
      userId: userDoc.id,
      items,
      total: parsed.data.total,
      status: OrderStatus.NEW,
      promoCode: parsed.data.promoCode ?? null,
      discount: parsed.data.discount ?? null,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });
    await orderRepo.save(newOrder);

    // Record promo code usage if applied
    // Uses unique constraint on (promoCodeId, userId) to prevent race conditions
    if (parsed.data.promoCode) {
      try {
        const upperCode = parsed.data.promoCode.trim().toUpperCase();
        const promo = await promoRepo.findOne({ where: { code: upperCode } });
        if (promo) {
          await ds.transaction(async (manager) => {
            await manager.getRepository(PromoCode).update(promo.id, {
              usedCount: () => "usedCount + 1",
            });
            const usage = manager.getRepository(PromoUsage).create({
              promoCodeId: promo.id,
              userId: userDoc.id,
            });
            await manager.getRepository(PromoUsage).save(usage);
          });
        }
      } catch (promoErr: unknown) {
        // ER_DUP_ENTRY = unique constraint violation = already used, which is fine
        const isDuplicateError =
          promoErr && typeof promoErr === "object" && "code" in promoErr &&
          (promoErr.code === "ER_DUP_ENTRY" || promoErr.code === "23505");
        if (!isDuplicateError) {
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
