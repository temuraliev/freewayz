import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@sanity/client";
import { validateUserInitData } from "@/lib/validate-user";
import { withErrorHandler, UnauthorizedError } from "@/lib/api/with-error-handler";

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  useCdn: true,
});

interface Ref {
  _id: string;
  title: string;
  slug: { current: string };
}

export const GET = withErrorHandler(async (request: NextRequest) => {
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const user = validateUserInitData(initData, request.headers.get("host"));
  if (!user) {
    throw new UnauthorizedError();
  }

  const telegramId = String(user.id);

  let userDoc = await prisma.user.findUnique({ where: { telegramId } });

  if (!userDoc) {
    userDoc = await prisma.user.create({
      data: {
        telegramId,
        firstName: user.first_name,
        username: user.username || null,
      },
    });
  }

  // Resolve preferred brands/styles from Sanity (parallel)
  const [preferredBrands, preferredStyles] = await Promise.all([
    userDoc.preferredBrandIds?.length
      ? sanity
          .fetch<Ref[]>(`*[_type == "brand" && _id in $ids] { _id, title, slug }`, {
            ids: userDoc.preferredBrandIds,
          })
          .catch(() => [] as Ref[])
      : Promise.resolve([] as Ref[]),
    userDoc.preferredStyleIds?.length
      ? sanity
          .fetch<Ref[]>(`*[_type == "style" && _id in $ids] { _id, title, slug }`, {
            ids: userDoc.preferredStyleIds,
          })
          .catch(() => [] as Ref[])
      : Promise.resolve([] as Ref[]),
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
