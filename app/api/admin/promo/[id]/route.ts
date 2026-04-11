import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@backend/db";
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

  const auth = validateAdminInitData(initData, request.headers.get("host"));
  if (!auth.ok) throw new UnauthorizedError();

  const numId = parseInt(id, 10);
  if (isNaN(numId)) throw new NotFoundError();

  const promo = await prisma.promoCode.findUnique({ where: { id: numId } });
  if (!promo) throw new NotFoundError("Промокод не найден");

  const update: Record<string, unknown> = {};
  if (typeof body.isActive === "boolean") update.isActive = body.isActive;

  await prisma.promoCode.update({ where: { id: numId }, data: update });

  return NextResponse.json({ ok: true });
});

export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";

  const auth = validateAdminInitData(initData, request.headers.get("host"));
  if (!auth.ok) throw new UnauthorizedError();

  const numId = parseInt(id, 10);
  if (isNaN(numId)) throw new NotFoundError();

  // Delete usage records first, then the code
  await prisma.promoUsage.deleteMany({ where: { promoCodeId: numId } });
  await prisma.promoCode.delete({ where: { id: numId } });

  return NextResponse.json({ ok: true });
});
