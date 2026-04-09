import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { validateUserInitData } from "@/lib/validate-user";
import {
  withErrorHandler,
  ValidationError,
} from "@/lib/api/with-error-handler";

const bodySchema = z.object({
  initData: z.string().min(1),
  productId: z.string().min(1),
  brandSlug: z.string().optional(),
  styleSlug: z.string().optional(),
});

/**
 * POST /api/products/view
 * Logs a product view for personalized recommendations and recently-viewed.
 *
 * Idempotent-ish: dedupes consecutive views of the same product within a short window
 * to avoid log spam from re-renders.
 */
const RECENT_VIEW_WINDOW_MS = 60 * 1000; // 1 min

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid view payload");

  const user = validateUserInitData(parsed.data.initData, request.headers.get("host"));
  if (!user) {
    // Don't fail — just don't track. Anonymous views aren't valuable here.
    return NextResponse.json({ ok: true, tracked: false });
  }

  const userDoc = await prisma.user.findUnique({
    where: { telegramId: String(user.id) },
    select: { id: true },
  });
  if (!userDoc) {
    return NextResponse.json({ ok: true, tracked: false });
  }

  // Dedupe: skip if last view of this product is recent
  const recent = await prisma.productView.findFirst({
    where: {
      userId: userDoc.id,
      productId: parsed.data.productId,
      viewedAt: { gte: new Date(Date.now() - RECENT_VIEW_WINDOW_MS) },
    },
    select: { id: true },
  });

  if (recent) {
    return NextResponse.json({ ok: true, tracked: false, deduped: true });
  }

  await prisma.productView.create({
    data: {
      userId: userDoc.id,
      productId: parsed.data.productId,
      brandSlug: parsed.data.brandSlug ?? null,
      styleSlug: parsed.data.styleSlug ?? null,
    },
  });

  return NextResponse.json({ ok: true, tracked: true });
});
