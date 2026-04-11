import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDataSource } from "@backend/data-source";
import { User } from "@backend/entities/User";
import { ProductViewEntity } from "@backend/entities/ProductView";
import { validateUserInitData } from "@backend/auth/validate-user";
import { MoreThanOrEqual } from "typeorm";
import {
  withErrorHandler,
  ValidationError,
} from "@backend/middleware/with-error-handler";

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

  const ds = await getDataSource();
  const userRepo = ds.getRepository(User);
  const viewRepo = ds.getRepository(ProductViewEntity);

  const userDoc = await userRepo.findOne({
    where: { telegramId: String(user.id) },
    select: { id: true },
  });
  if (!userDoc) {
    return NextResponse.json({ ok: true, tracked: false });
  }

  // Dedupe: skip if last view of this product is recent
  const recent = await viewRepo.findOne({
    where: {
      userId: userDoc.id,
      productId: parsed.data.productId,
      viewedAt: MoreThanOrEqual(new Date(Date.now() - RECENT_VIEW_WINDOW_MS)),
    },
    select: { id: true },
  });

  if (recent) {
    return NextResponse.json({ ok: true, tracked: false, deduped: true });
  }

  const view = viewRepo.create({
    userId: userDoc.id,
    productId: parsed.data.productId,
    brandSlug: parsed.data.brandSlug ?? null,
    styleSlug: parsed.data.styleSlug ?? null,
  });
  await viewRepo.save(view);

  return NextResponse.json({ ok: true, tracked: true });
});
