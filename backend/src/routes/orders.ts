import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { validateTelegramInitData } from "../lib/telegram-auth.js";
import { validateUserInitData } from "../lib/validate-user.js";

const app = new Hono();

// ── POST / — create order ─────────────────────────────────
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

app.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON" }, 400);

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);

  const adminBotToken = (process.env.ADMIN_BOT_TOKEN || "").replace(/\r\n?|\n/g, "").trim();
  const customerBotToken = (process.env.BOT_TOKEN || "").replace(/\r\n?|\n/g, "").trim();

  let tgUser: { id: number; username?: string; first_name: string } | null = null;
  for (const tok of [customerBotToken, adminBotToken]) {
    if (!tok) continue;
    const result = validateTelegramInitData(parsed.data.initData, tok);
    if (result) { tgUser = result.user; break; }
  }
  if (!tgUser) return c.json({ error: "Invalid initData" }, 401);

  try {
    const telegramId = String(tgUser.id);
    const userDoc = await prisma.user.upsert({
      where: { telegramId },
      update: {},
      create: { telegramId, username: tgUser.username || null, firstName: tgUser.first_name },
    });

    const idempotencyKey = parsed.data.idempotencyKey || c.req.header("X-Idempotency-Key");
    if (idempotencyKey) {
      const existing = await prisma.order.findUnique({ where: { idempotencyKey }, select: { orderId: true } });
      if (existing) return c.json({ ok: true, orderId: existing.orderId });
    }

    const orderId = `${Date.now().toString(36).toUpperCase()}`;
    const items = parsed.data.items.map((it) => ({
      productId: it.productId, title: it.title, brand: it.brand,
      size: it.size, color: it.color, price: it.price, quantity: it.quantity,
    }));

    await prisma.order.create({
      data: {
        orderId, userId: userDoc.id, items, total: parsed.data.total, status: "new",
        promoCode: parsed.data.promoCode ?? null, discount: parsed.data.discount ?? null,
        ...(idempotencyKey ? { idempotencyKey } : {}),
      },
    });

    if (parsed.data.promoCode) {
      try {
        const upperCode = parsed.data.promoCode.trim().toUpperCase();
        const promo = await prisma.promoCode.findUnique({ where: { code: upperCode } });
        if (promo) {
          await prisma.$transaction([
            prisma.promoCode.update({ where: { id: promo.id }, data: { usedCount: { increment: 1 } } }),
            prisma.promoUsage.create({ data: { promoCodeId: promo.id, userId: userDoc.id } }),
          ]);
        }
      } catch (promoErr: unknown) {
        const isPrismaUniqueError = promoErr && typeof promoErr === "object" && "code" in promoErr && promoErr.code === "P2002";
        if (!isPrismaUniqueError) console.error("Failed to record promo usage:", promoErr);
      }
    }

    // Notify admins
    const adminIds = (process.env.ADMIN_TELEGRAM_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const botToken = adminBotToken || customerBotToken;
    if (botToken && adminIds.length > 0) {
      const itemLines = parsed.data.items.map((it, i) => `  ${i + 1}. ${it.brand} ${it.title} — ${it.size}`).join("\n");
      const promoLine = parsed.data.promoCode
        ? `\nПромокод: ${parsed.data.promoCode} (−${(parsed.data.discount || 0).toLocaleString()} UZS)` : "";
      const text = `Новый заказ #${orderId}\nКлиент: @${tgUser.username || tgUser.first_name}\nТоваров: ${parsed.data.items.length}\nСумма: ${parsed.data.total.toLocaleString()} UZS${promoLine}\n\n${itemLines}`;
      for (const chatId of adminIds) {
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text }),
        }).catch((e) => console.error("Notify admin:", e));
      }
    }

    return c.json({ ok: true, orderId });
  } catch (e) {
    console.error("Order create error:", e);
    return c.json({ error: "Create failed" }, 500);
  }
});

// ── GET /history ──────────────────────────────────────────
app.get("/history", async (c) => {
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  const user = validateUserInitData(initData, c.req.header("host"));
  if (!user) return c.json({ orders: [] });

  const userDoc = await prisma.user.findUnique({ where: { telegramId: String(user.id) }, select: { id: true } });
  if (!userDoc) return c.json({ orders: [] });

  const orders = await prisma.order.findMany({
    where: { userId: userDoc.id }, orderBy: { createdAt: "desc" },
    select: { orderId: true, status: true, total: true, trackNumber: true, trackUrl: true, createdAt: true },
    take: 50,
  });

  return c.json({ orders });
});

export { app as ordersRoutes };
