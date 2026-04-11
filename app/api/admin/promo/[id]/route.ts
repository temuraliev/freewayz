import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@backend/data-source";
import { PromoCode } from "@backend/entities/PromoCode";
import { PromoUsage } from "@backend/entities/PromoUsage";
import { validateAdminInitData } from "@backend/auth/admin-auth";
import {
  withErrorHandler,
  UnauthorizedError,
  NotFoundError,
} from "@backend/middleware/with-error-handler";

export const PATCH = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const body = await request.json();
  const initData = body?.initData ?? request.headers.get("X-Telegram-Init-Data") ?? "";

  const auth = await validateAdminInitData(initData, request.headers.get("host"));
  if (!auth.ok) throw new UnauthorizedError();

  const numId = parseInt(id, 10);
  if (isNaN(numId)) throw new NotFoundError();

  const ds = await getDataSource();
  const promoRepo = ds.getRepository(PromoCode);

  const promo = await promoRepo.findOne({ where: { id: numId } });
  if (!promo) throw new NotFoundError("Промокод не найден");

  const update: Record<string, unknown> = {};
  if (typeof body.isActive === "boolean") update.isActive = body.isActive;

  await promoRepo.update(numId, update);

  return NextResponse.json({ ok: true });
});

export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";

  const auth = await validateAdminInitData(initData, request.headers.get("host"));
  if (!auth.ok) throw new UnauthorizedError();

  const numId = parseInt(id, 10);
  if (isNaN(numId)) throw new NotFoundError();

  const ds = await getDataSource();

  // Delete usage records first, then the code
  await ds.getRepository(PromoUsage).delete({ promoCodeId: numId });
  await ds.getRepository(PromoCode).delete({ id: numId });

  return NextResponse.json({ ok: true });
});
