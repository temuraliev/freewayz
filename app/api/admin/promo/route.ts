import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { validateAdminInitData } from "@/lib/admin-auth";
import {
  withErrorHandler,
  UnauthorizedError,
  ValidationError,
} from "@/lib/api/with-error-handler";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, request.headers.get("host"));
  if (!auth.ok) throw new UnauthorizedError();

  const codes = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { usedBy: true } },
    },
  });

  return NextResponse.json(codes);
});

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

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid promo payload");

  const auth = validateAdminInitData(parsed.data.initData, request.headers.get("host"));
  if (!auth.ok) throw new UnauthorizedError();

  const existing = await prisma.promoCode.findUnique({
    where: { code: parsed.data.code },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Промокод ${parsed.data.code} уже существует`, code: "DUPLICATE" },
      { status: 409 }
    );
  }

  const promo = await prisma.promoCode.create({
    data: {
      code: parsed.data.code,
      type: parsed.data.type,
      value: parsed.data.value,
      maxUses: parsed.data.maxUses ?? null,
      maxUsesPerUser: parsed.data.maxUsesPerUser,
      minOrderTotal: parsed.data.minOrderTotal ?? null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      isActive: true,
      usedCount: 0,
    },
  });

  return NextResponse.json({ ok: true, id: promo.id, code: promo.code });
});
