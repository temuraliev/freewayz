import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { validateAdminInitData } from "../../lib/admin-auth.js";
import { Prisma } from "@prisma/client";

const app = new Hono();

const dateString = z.string().refine((s) => !s || !isNaN(Date.parse(s)), "Invalid date").optional();

// ── GET / ─────────────────────────────────────────────────
app.get("/", async (c) => {
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, c.req.header("host"));
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);

  const from = c.req.query("from");
  const to = c.req.query("to");

  const expenseWhere: { date?: { gte?: Date; lte?: Date } } = {};
  if (from) expenseWhere.date = { ...(expenseWhere.date ?? {}), gte: new Date(from) };
  if (to) { const toEnd = new Date(to); toEnd.setHours(23, 59, 59, 999); expenseWhere.date = { ...(expenseWhere.date ?? {}), lte: toEnd }; }

  const orderWhere: { status: { not: "cancelled" }; createdAt?: { gte?: Date; lte?: Date } } = { status: { not: "cancelled" } };
  if (from) orderWhere.createdAt = { ...(orderWhere.createdAt ?? {}), gte: new Date(from) };
  if (to) { const toEnd = new Date(to); toEnd.setHours(23, 59, 59, 999); orderWhere.createdAt = { ...(orderWhere.createdAt ?? {}), lte: toEnd }; }

  const [expenses, orders] = await Promise.all([
    prisma.expense.findMany({ where: expenseWhere, orderBy: { date: "desc" }, select: { id: true, date: true, amount: true, currency: true, category: true, description: true } }),
    prisma.order.findMany({ where: orderWhere, select: { total: true, cost: true } }),
  ]);

  const revenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const costOfGoods = orders.reduce((s, o) => s + (o.cost || 0), 0);
  const totalExpense = expenses.reduce((s, e) => { const amt = Number(e.amount) || 0; return s + (e.currency === "UZS" ? amt : amt * 1600); }, 0);

  return c.json({ expenses, revenue, costOfGoods, totalExpense, profit: revenue - costOfGoods - totalExpense });
});

// ── POST / (create expense) ──────────────────────────────
const expenseSchema = z.object({
  initData: z.string(),
  date: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid date"),
  amount: z.number().positive(),
  currency: z.enum(["UZS", "CNY", "USD"]),
  category: z.enum(["shipping", "purchase", "packaging", "other"]),
  description: z.string().max(500).optional(),
});

app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid expense payload" }, 400);

  const auth = validateAdminInitData(parsed.data.initData, c.req.header("host"));
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);

  await prisma.expense.create({
    data: { date: new Date(parsed.data.date), amount: parsed.data.amount, currency: parsed.data.currency, category: parsed.data.category, description: parsed.data.description ?? null },
  });
  return c.json({ ok: true });
});

// ── GET /daily ────────────────────────────────────────────
interface DailyRow { day: Date; revenue: number; order_count: bigint; }

app.get("/daily", async (c) => {
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, c.req.header("host"));
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);

  const daysParam = parseInt(c.req.query("days") || "30", 10);
  const days = Math.min(Math.max(daysParam, 1), 365);

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<DailyRow[]>`
    SELECT DATE_TRUNC('day', "createdAt") AS day, COALESCE(SUM(total), 0)::float AS revenue, COUNT(*) AS order_count
    FROM "Order" WHERE "createdAt" >= ${since} AND status != 'cancelled' GROUP BY day ORDER BY day ASC
  `;

  const dayMap = new Map<string, { revenue: number; orderCount: number }>();
  for (const row of rows) dayMap.set(new Date(row.day).toISOString().slice(0, 10), { revenue: row.revenue, orderCount: Number(row.order_count) });

  const result: { date: string; revenue: number; orderCount: number }[] = [];
  const cursor = new Date(since);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  while (cursor <= today) {
    const key = cursor.toISOString().slice(0, 10);
    result.push({ date: key, ...(dayMap.get(key) ?? { revenue: 0, orderCount: 0 }) });
    cursor.setDate(cursor.getDate() + 1);
  }

  void Prisma; // suppress unused import
  return c.json({ days, data: result });
});

// ── GET /dashboard ────────────────────────────────────────
app.get("/dashboard", async (c) => {
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, c.req.header("host"));
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [newOrdersCount, ordersWithoutTrack, abandonedCartsCount, totalOrders, totalRevenue, ordersInTransit, totalCustomers] = await Promise.all([
    prisma.order.count({ where: { status: "new" } }),
    prisma.order.count({ where: { status: "ordered", trackNumber: null } }),
    prisma.user.count({ where: { cartItems: { not: null }, cartUpdatedAt: { lt: twentyFourHoursAgo }, abandonedCartNotified: false } }),
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { total: true }, where: { status: { not: "cancelled" } } }),
    prisma.order.count({ where: { status: "shipped" } }),
    prisma.user.count(),
  ]);

  return c.json({
    alerts: [
      ...(newOrdersCount > 0 ? [{ type: "warning", text: `${newOrdersCount} новых заказов ждут подтверждения`, link: "/admin/orders?status=new" }] : []),
      ...(ordersWithoutTrack > 0 ? [{ type: "info", text: `${ordersWithoutTrack} заказов без трек-номера`, link: "/admin/orders?status=ordered" }] : []),
      ...(abandonedCartsCount > 0 ? [{ type: "info", text: `${abandonedCartsCount} брошенных корзин за 24ч`, link: null }] : []),
    ],
    stats: { totalOrders, totalRevenue: totalRevenue._sum.total ?? 0, ordersInTransit, totalCustomers, newOrdersCount },
  });
});

export { app as adminFinanceRoutes };
