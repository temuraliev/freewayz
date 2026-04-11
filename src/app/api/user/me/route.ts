import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@backend/data-source";
import { User } from "@backend/entities/User";
import { UserPreference } from "@backend/entities/UserPreference";
import { validateUserInitData } from "@backend/auth/validate-user";
import { withErrorHandler, UnauthorizedError } from "@backend/middleware/with-error-handler";
import { Brand } from "@backend/entities/Brand";
import { Style } from "@backend/entities/Style";
import { toFrontendBrand, toFrontendStyle } from "@backend/repositories/product-repository";
import { In } from "typeorm";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const user = validateUserInitData(initData, request.headers.get("host"));
  if (!user) {
    throw new UnauthorizedError();
  }

  const telegramId = String(user.id);

  const ds = await getDataSource();
  const userRepo = ds.getRepository(User);
  const prefRepo = ds.getRepository(UserPreference);

  let userDoc = await userRepo.findOne({
    where: { telegramId },
  });

  if (!userDoc) {
    userDoc = userRepo.create({
      telegramId,
      firstName: user.first_name,
      username: user.username || null,
    });
    userDoc = await userRepo.save(userDoc);
  }

  const userPreferences = await prefRepo.find({
    where: { userId: userDoc.id },
    select: { preferenceType: true, externalId: true },
  });

  // Use normalized prefs if present, fall back to legacy fields
  const normalizedBrandIds = userPreferences
    .filter((p) => p.preferenceType === "brand")
    .map((p) => p.externalId);
  const normalizedStyleIds = userPreferences
    .filter((p) => p.preferenceType === "style")
    .map((p) => p.externalId);

  const brandIds = normalizedBrandIds.length > 0 ? normalizedBrandIds : (userDoc.preferredBrandIds ?? []);
  const styleIds = normalizedStyleIds.length > 0 ? normalizedStyleIds : (userDoc.preferredStyleIds ?? []);

  // Resolve preferred brands/styles from MySQL
  const [preferredBrands, preferredStyles] = await Promise.all([
    brandIds.length > 0
      ? ds.getRepository(Brand).find({ where: { id: In(brandIds.map(Number).filter((n) => !isNaN(n))) } }).then((b) => b.map(toFrontendBrand)).catch(() => [])
      : Promise.resolve([]),
    styleIds.length > 0
      ? ds.getRepository(Style).find({ where: { id: In(styleIds.map(Number).filter((n) => !isNaN(n))) } }).then((s) => s.map(toFrontendStyle)).catch(() => [])
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    _id: String(userDoc.id),
    telegramId: userDoc.telegramId,
    username: userDoc.username,
    firstName: userDoc.firstName,
    lastName: userDoc.lastName,
    photoUrl: userDoc.photoUrl,
    totalSpent: userDoc.totalSpent,
    status: userDoc.status,
    cashbackBalance: userDoc.cashbackBalance,
    onboardingDone: userDoc.onboardingDone,
    preferredBrands,
    preferredStyles,
  });
});
