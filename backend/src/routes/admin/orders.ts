import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { validateAdminInitData } from "../../lib/admin-auth.js";

const app = new Hono();

type OrderStatus = "new" | "paid" | "ordered" | "shipped" | "delivered" | "cancelled";

// ── GET / ─────────────────────────────────────────────────
app.get("/", async (c) => {
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, c.req.header("host"));
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);

  const status = c.req.query("status") || "";
  const search = c.req.query("q") || "";

  const where: { status?: OrderStatus; OR?: Array<{ orderId: { contains: string; mode: "insensitive" } } | { user: { username: { contains: string; mode: "insensitive" } } }> } = {};
  if (status && status !== "all") where.status = status as OrderStatus;
  if (search) where.OR = [{ orderId: { contains: search, mode: "insensitive" } }, { user: { username: { contains: search, mode: "insensitive" } } }];

  const [orders, counts, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { id: true, telegramId: true, username: true, firstName: true } } } }),
    prisma.order.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.order.count(),
  ]);

  const statusCounts: Record<string, number> = { all: total, new: 0, paid: 0, ordered: 0, shipped: 0, delivered: 0, cancelled: 0 };
  for (const c of counts) statusCounts[c.status] = c._count.status;

  return c.json({
    orders: orders.map((o) => ({
      id: o.id, orderId: o.orderId, total: o.total, status: o.status,
      trackNumber: o.trackNumber, trackUrl: o.trackUrl, trackingStatus: o.trackingStatus,
      notes: o.notes, createdAt: o.createdAt,
      user: o.user ? { id: o.user.id, telegramId: o.user.telegramId, username: o.user.username, firstName: o.user.firstName } : null,
    })),
    counts: statusCounts,
  });
});

// ── GET /export ───────────────────────────────────────────
app.get("/export", async (c) => {
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, c.req.header("host"));
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);

  const status = c.req.query("status") || "";
  const from = c.req.query("from");
  const to = c.req.query("to");

  const where: { status?: OrderStatus; createdAt?: { gte?: Date; lte?: Date } } = {};
  if (status && status !== "all") where.status = status as OrderStatus;
  if (from) where.createdAt = { ...(where.createdAt ?? {}), gte: new Date(from) };
  if (to) { const toEnd = new Date(to); toEnd.setHours(23, 59, 59, 999); where.createdAt = { ...(where.createdAt ?? {}), lte: toEnd }; }

  const orders = await prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, include: { user: { select: { username: true, firstName: true, telegramId: true } } }, take: 10000 });

  const csvEscape = (v: unknown) => { if (v == null) return ""; const s = String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const headers = ["Order ID", "Status", "Created", "Customer Username", "Customer Name", "Telegram ID", "Item Count", "Total (UZS)", "Cost (UZS)", "Track Number", "Tracking Status", "Notes"];
  const rows = orders.map((o) => {
    const items = Array.isArray(o.items) ? (o.items as unknown[]) : [];
    return [o.orderId, o.status, o.createdAt?.toISOString() ?? "", o.user?.username ?? "", o.user?.firstName ?? "", o.user?.telegramId ?? "", items.length, o.total, o.cost ?? "", o.trackNumber ?? "", o.trackingStatus ?? "", (o.notes ?? "").replace(/\r?\n/g, " ")].map(csvEscape).join(",");
  });

  const csv = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
  return new Response(csv, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"` } });
});

// ── GET /:id ──────────────────────────────────────────────
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, c.req.header("host"));
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);

  const numericId = parseInt(id, 10);
  const order = await prisma.order.findFirst({
    where: isNaN(numericId) ? { orderId: id } : { OR: [{ id: numericId }, { orderId: id }] },
    include: { user: { select: { id: true, telegramId: true, username: true, firstName: true } } },
  });
  if (!order) return c.json({ error: "Not found" }, 404);
  return c.json({ ...order, user: order.user ?? null });
});

// ── PATCH /:id ────────────────────────────────────────────
const patchSchema = z.object({
  initData: z.string(),
  status: z.enum(["new", "paid", "ordered", "shipped", "delivered", "cancelled"]).optional(),
  trackNumber: z.string().optional(),
  trackUrl: z.string().url().optional().nullable(),
  notes: z.string().optional(),
  cost: z.number().min(0).optional().nullable(),
});

app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON" }, 400);

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation failed" }, 400);

  const auth = validateAdminInitData(parsed.data.initData ?? "", c.req.header("host"));
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);

  const numericId = parseInt(id, 10);
  const prev = await prisma.order.findFirst({
    where: isNaN(numericId) ? { orderId: id } : { OR: [{ id: numericId }, { orderId: id }] },
    include: { user: { select: { telegramId: true } } },
  });
  if (!prev) return c.json({ error: "Not found" }, 404);

  const updateData: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.trackNumber !== undefined) updateData.trackNumber = parsed.data.trackNumber;
  if (parsed.data.trackUrl !== undefined) updateData.trackUrl = parsed.data.trackUrl;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
  if (parsed.data.cost !== undefined) updateData.cost = parsed.data.cost;

  await prisma.order.update({ where: { id: prev.id }, data: updateData });

  // Register with 17track
  if (parsed.data.trackNumber && !prev.track17Registered) {
    const apiKey = (process.env.TRACK17_API_KEY || "").trim();
    if (apiKey) {
      const ok = await fetch("https://api.17track.net/track/v2.2/register", {
        method: "POST", headers: { "17token": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify([{ number: parsed.data.trackNumber }]),
      }).then((r) => r.ok).catch(() => false);
      if (ok) await prisma.order.update({ where: { id: prev.id }, data: { track17Registered: true } });
      if (!parsed.data.trackUrl) {
        const url = `https://t.17track.net/en#nums=${encodeURIComponent(parsed.data.trackNumber)}`;
        await prisma.order.update({ where: { id: prev.id }, data: { trackUrl: url } });
      }
    }
  }

  // Notify customer
  const telegramId = prev.user?.telegramId ?? null;
  const newStatus = parsed.data.status;
  if (telegramId && newStatus && newStatus !== prev.status) {
    const botToken = (process.env.BOT_TOKEN || process.env.ADMIN_BOT_TOKEN || "").replace(/\r\n?|\n/g, "").trim();
    const orderId = prev.orderId;
    const msgs: Record<string, string> = {
      paid: `💳 Оплата заказа #${orderId} получена! Готовим к отправке.`,
      ordered: `📦 Заказ #${orderId} подтверждён и передан в работу.`,
      shipped: `🚚 Заказ #${orderId} отправлен!${parsed.data.trackNumber ? `\n\nТрек-номер: ${parsed.data.trackNumber}${parsed.data.trackUrl ? `\n${parsed.data.trackUrl}` : ""}` : ""}`,
      delivered: `✅ Заказ #${orderId} доставлен! Спасибо за покупку 🙌`,
      cancelled: `❌ Заказ #${orderId} отменён. Если есть вопросы — напиши нам.`,
    };
    if (botToken && msgs[newStatus]) {
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: telegramId, text: msgs[newStatus] }),
      }).catch((e) => console.error("Notify customer:", e));
    }
  }

  return c.json({ ok: true });
});

// ── GET /dashboard (mounted at /api/admin/orders, but let's use dedicated endpoint) ──
// Dashboard is a separate handler
export { app as adminOrdersRoutes };
