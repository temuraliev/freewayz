import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { validateAdminInitData } from "../../lib/admin-auth.js";

const app = new Hono();

// ── GET / ─────────────────────────────────────────────────
app.get("/", async (c) => {
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, c.req.header("host"));
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);

  const codes = await prisma.promoCode.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { usedBy: true } } } });
  return c.json(codes);
});

// ── POST / ────────────────────────────────────────────────
const createSchema = z.object({
  initData: z.string(),
  code: z.string().min(1).max(64).transform((s) => s.trim().toUpperCase()),
  type: z.enum(["discount_percent", "discount_fixed", "balance_topup"]),
  value: z.number().positive(),
  maxUses: z.number().int().positive().optional(),
  maxUsesPerUser: z.number().int().positive().default(1),
  minOrderTotal: z.number().nonnegative().optional(),
  expiresAt: z.string().optional(),
});

app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid promo payload" }, 400);

  const auth = validateAdminInitData(parsed.data.initData, c.req.header("host"));
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);

  const existing = await prisma.promoCode.findUnique({ where: { code: parsed.data.code } });
  if (existing) return c.json({ error: `Промокод ${parsed.data.code} уже существует`, code: "DUPLICATE" }, 409);

  const promo = await prisma.promoCode.create({
    data: {
      code: parsed.data.code, type: parsed.data.type, value: parsed.data.value,
      maxUses: parsed.data.maxUses ?? null, maxUsesPerUser: parsed.data.maxUsesPerUser,
      minOrderTotal: parsed.data.minOrderTotal ?? null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      isActive: true, usedCount: 0,
    },
  });

  return c.json({ ok: true, id: promo.id, code: promo.code });
});

// ── PATCH /:id ────────────────────────────────────────────
app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const initData = body?.initData ?? c.req.header("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, c.req.header("host"));
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);

  const numId = parseInt(id, 10);
  if (isNaN(numId)) return c.json({ error: "Not found" }, 404);

  const promo = await prisma.promoCode.findUnique({ where: { id: numId } });
  if (!promo) return c.json({ error: "Промокод не найден" }, 404);

  const update: Record<string, unknown> = {};
  if (typeof body.isActive === "boolean") update.isActive = body.isActive;

  await prisma.promoCode.update({ where: { id: numId }, data: update });
  return c.json({ ok: true });
});

// ── DELETE /:id ───────────────────────────────────────────
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const initData = c.req.header("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, c.req.header("host"));
  if (!auth.ok) return c.json({ error: "Unauthorized" }, 401);

  const numId = parseInt(id, 10);
  if (isNaN(numId)) return c.json({ error: "Not found" }, 404);

  await prisma.promoUsage.deleteMany({ where: { promoCodeId: numId } });
  await prisma.promoCode.delete({ where: { id: numId } });
  return c.json({ ok: true });
});

export { app as adminPromoRoutes };
