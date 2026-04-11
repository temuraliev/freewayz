import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@backend/db";
import { validateUserInitData } from "@backend/auth/validate-user";
import { setPreferences } from "@backend/services/preferences-service";
import {
  withErrorHandler,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from "@backend/middleware/with-error-handler";

const bodySchema = z.object({
  initData: z.string().min(1),
  brandIds: z.array(z.string().min(1)).max(50).default([]),
  styleIds: z.array(z.string().min(1)).max(50).default([]),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid preferences payload");
  }

  const user = validateUserInitData(parsed.data.initData, request.headers.get("host"));
  if (!user) {
    throw new UnauthorizedError();
  }

  const telegramId = String(user.id);

  const userDoc = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true },
  });

  if (!userDoc) {
    throw new NotFoundError("User not found");
  }

  // Dedupe IDs
  const brandIds = Array.from(new Set(parsed.data.brandIds));
  const styleIds = Array.from(new Set(parsed.data.styleIds));

  // Write to legacy string[] fields
  await prisma.user.update({
    where: { id: userDoc.id },
    data: {
      preferredBrandIds: brandIds,
      preferredStyleIds: styleIds,
      onboardingDone: true,
    },
  });

  // Also write to new UserPreference table
  try {
    await setPreferences(userDoc.id, brandIds, styleIds);
  } catch (err) {
    console.error("UserPreference sync failed (legacy data still saved):", err);
  }

  return NextResponse.json({ ok: true });
});
