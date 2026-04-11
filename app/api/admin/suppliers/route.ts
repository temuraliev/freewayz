import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@sanity/client";
import { isAdminRequest } from "@backend/auth/admin-gate";
import {
  withErrorHandler,
  UnauthorizedError,
  ValidationError,
  ApiError,
} from "@backend/middleware/with-error-handler";

function getSanityClient() {
  const token = process.env.SANITY_API_TOKEN;
  if (!token) throw new ApiError("Sanity token not configured", 500, "CONFIG_ERROR");
  return createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
    apiVersion: "2024-01-01",
    useCdn: false,
    token,
  });
}

export const GET = withErrorHandler(async (request: NextRequest) => {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const auth = isAdminRequest(request, initData);
  if (!auth.ok) throw new UnauthorizedError();

  const client = getSanityClient();
  const list = await client.fetch(
    `*[_type == "yupooSupplier"] | order(name asc) { _id, name, url, lastCheckedAt, lastAlbumCount, isActive }`
  );
  return NextResponse.json(list ?? []);
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

  const auth = isAdminRequest(request, parsed.data.initData ?? "");
  if (!auth.ok) throw new UnauthorizedError();

  const client = getSanityClient();
  const doc = await client.create({
    _type: "yupooSupplier",
    name: parsed.data.name.trim(),
    url: parsed.data.url.trim(),
    isActive: true,
  });
  return NextResponse.json({ ok: true, id: doc._id });
});
