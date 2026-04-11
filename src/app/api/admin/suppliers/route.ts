import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@backend/auth/admin-gate";
import { getDataSource } from "@backend/data-source";
import { Supplier } from "@backend/entities/Supplier";
import {
  withErrorHandler,
  UnauthorizedError,
  ValidationError,
} from "@backend/middleware/with-error-handler";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const auth = await isAdminRequest(request, initData);
  if (!auth.ok) throw new UnauthorizedError();

  const ds = await getDataSource();
  const list = await ds.getRepository(Supplier).find({
    order: { name: "ASC" },
  });

  return NextResponse.json(
    list.map((s) => ({
      _id: String(s.id),
      name: s.name,
      url: s.url,
      lastCheckedAt: s.lastCheckedAt,
      lastAlbumCount: s.lastAlbumCount,
      isActive: s.isActive,
    }))
  );
});

const createSchema = z.object({
  initData: z.string().optional(),
  name: z.string().min(1).max(200),
  url: z.string().url(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid supplier payload");

  const auth = await isAdminRequest(request, parsed.data.initData ?? "");
  if (!auth.ok) throw new UnauthorizedError();

  const ds = await getDataSource();
  const supplier = ds.getRepository(Supplier).create({
    name: parsed.data.name.trim(),
    url: parsed.data.url.trim(),
    isActive: true,
  });
  const saved = await ds.getRepository(Supplier).save(supplier);

  return NextResponse.json({ ok: true, id: saved.id });
});
