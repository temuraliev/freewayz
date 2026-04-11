import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { validateUserInitData } from "../lib/validate-user.js";
import { ValidationError } from "../index.js";

const app = new Hono();

const bodySchema = z.object({
  initData: z.string().min(1),
  productId: z.string().min(1),
  brandSlug: z.string().optional(),
  styleSlug: z.string().optional(),
});

const RECENT_VIEW_WINDOW_MS = 60 * 1000;

app.post("/view", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid view payload");

  const user = validateUserInitData(parsed.data.initData, c.req.header("host"));
  if (!user) return c.json({ ok: true, tracked: false });

  const userDoc = await prisma.user.findUnique({ where: { telegramId: String(user.id) }, select: { id: true } });
  if (!userDoc) return c.json({ ok: true, tracked: false });

  const recent = await prisma.productView.findFirst({
    where: {
      userId: userDoc.id,
      productId: parsed.data.productId,
      viewedAt: { gte: new Date(Date.now() - RECENT_VIEW_WINDOW_MS) },
    },
    select: { id: true },
  });

  if (recent) return c.json({ ok: true, tracked: false, deduped: true });

  await prisma.productView.create({
    data: {
      userId: userDoc.id,
      productId: parsed.data.productId,
      brandSlug: parsed.data.brandSlug ?? null,
      styleSlug: parsed.data.styleSlug ?? null,
    },
  });

  return c.json({ ok: true, tracked: true });
});

export { app as productsRoutes };
