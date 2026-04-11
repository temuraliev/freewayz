import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDataSource } from "@backend/data-source";
import { PromoCode } from "@backend/entities/PromoCode";
import { validateAdminInitData } from "@backend/auth/admin-auth";
import {
  withErrorHandler,
  UnauthorizedError,
  ValidationError,
} from "@backend/middleware/with-error-handler";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, request.headers.get("host"));
  if (!auth.ok) throw new UnauthorizedError();

  const ds = await getDataSource();
  const promoRepo = ds.getRepository(PromoCode);

  const codes = await promoRepo
    .createQueryBuilder("p")
    .loadRelationCountAndMap("p._count_usedBy", "p.usedBy")
    .orderBy("p.createdAt", "DESC")
    .getMany();

  // Map to match Prisma's _count shape
  const formatted = codes.map((p) => ({
    ...p,
    _count: { usedBy: (p as unknown as Record<string, number>)._count_usedBy ?? 0 },
  }));

  // Remove the internal field
  for (const item of formatted) {
    delete (item as Record<string, unknown>)._count_usedBy;
  }

  return NextResponse.json(formatted);
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

  const ds = await getDataSource();
  const promoRepo = ds.getRepository(PromoCode);

  const existing = await promoRepo.findOne({
    where: { code: parsed.data.code },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Промокод ${parsed.data.code} уже существует`, code: "DUPLICATE" },
      { status: 409 }
    );
  }

  const promo = promoRepo.create({
    code: parsed.data.code,
    type: parsed.data.type as PromoCode["type"],
    value: parsed.data.value,
    maxUses: parsed.data.maxUses ?? null,
    maxUsesPerUser: parsed.data.maxUsesPerUser,
    minOrderTotal: parsed.data.minOrderTotal ?? null,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    isActive: true,
    usedCount: 0,
  });

  const saved = await promoRepo.save(promo);

  return NextResponse.json({ ok: true, id: saved.id, code: saved.code });
});
