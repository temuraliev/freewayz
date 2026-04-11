import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { validateAdminInitData } from "../../lib/admin-auth.js";
import { Prisma } from "@prisma/client";

const app = new Hono();

// ── GET / ─────────────────────────────────────────────────
interface CustomerRow {
  id: number; telegramId: string; username: string | null;
  firstName: string | null; lastName: string | null; phone: string | null;
  address: string | null; adminNotes: string | null; totalSpent: number;
  status: string; cashbackBalance: number; orderCount: bigint; lastOrderDate: Date | null;
}

app.get("/", async (c) => {
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, c.req.header("host"));
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);

  const search = (c.req.query("q") || "").trim();
  const searchPattern = `%${search}%`;

  const rows = await prisma.$queryRaw<CustomerRow[]>`
    SELECT u.id, u."telegramId", u.username, u."firstName", u."lastName",
      u.phone, u.address, u."adminNotes", u."totalSpent", u.status::text AS status,
      u."cashbackBalance", COALESCE(o.order_count, 0) AS "orderCount", o.last_order_date AS "lastOrderDate"
    FROM "User" u
    LEFT JOIN (SELECT "userId", COUNT(*) AS order_count, MAX("createdAt") AS last_order_date FROM "Order" GROUP BY "userId") o ON o."userId" = u.id
    ${search ? Prisma.sql`WHERE u.username ILIKE ${searchPattern} OR u."firstName" ILIKE ${searchPattern} OR u."telegramId" = ${search}` : Prisma.empty}
    ORDER BY u."totalSpent" DESC LIMIT 200
  `;

  return c.json(rows.map((u) => ({
    id: u.id, telegramId: u.telegramId, username: u.username, firstName: u.firstName,
    lastName: u.lastName, phone: u.phone, address: u.address, adminNotes: u.adminNotes,
    totalSpent: u.totalSpent, status: u.status, cashbackBalance: u.cashbackBalance,
    orderCount: Number(u.orderCount), lastOrderDate: u.lastOrderDate,
  })));
});

// ── PATCH /:id ────────────────────────────────────────────
const patchSchema = z.object({
  initData: z.string(),
  adminNotes: z.string().max(2000).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
});

app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);

  const auth = validateAdminInitData(parsed.data.initData, c.req.header("host"));
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);

  const numId = parseInt(id, 10);
  if (isNaN(numId)) return c.json({ error: "Not found" }, 404);

  const user = await prisma.user.findUnique({ where: { id: numId } });
  if (!user) return c.json({ error: "Пользователь не найден" }, 404);

  const update: Record<string, unknown> = {};
  if (parsed.data.adminNotes !== undefined) update.adminNotes = parsed.data.adminNotes || null;
  if (parsed.data.phone !== undefined) update.phone = parsed.data.phone || null;
  if (parsed.data.address !== undefined) update.address = parsed.data.address || null;

  await prisma.user.update({ where: { id: numId }, data: update });
  return c.json({ ok: true });
});

export { app as adminCustomersRoutes };
