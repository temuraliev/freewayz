import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@backend/db";
import { validateAdminInitData } from "@backend/auth/admin-auth";
import {
  withErrorHandler,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from "@backend/middleware/with-error-handler";

const patchSchema = z.object({
  initData: z.string(),
  adminNotes: z.string().max(2000).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
});

export const PATCH = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid payload");

  const auth = validateAdminInitData(parsed.data.initData, request.headers.get("host"));
  if (!auth.ok) throw new UnauthorizedError();

  const numId = parseInt(id, 10);
  if (isNaN(numId)) throw new NotFoundError();

  const user = await prisma.user.findUnique({ where: { id: numId } });
  if (!user) throw new NotFoundError("Пользователь не найден");

  const update: Record<string, unknown> = {};
  if (parsed.data.adminNotes !== undefined) update.adminNotes = parsed.data.adminNotes || null;
  if (parsed.data.phone !== undefined) update.phone = parsed.data.phone || null;
  if (parsed.data.address !== undefined) update.address = parsed.data.address || null;

  await prisma.user.update({ where: { id: numId }, data: update });

  return NextResponse.json({ ok: true });
});
