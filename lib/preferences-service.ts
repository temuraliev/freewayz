import { prisma } from "@/lib/db";
import type { PreferenceType } from "@prisma/client";

/**
 * User preferences service using normalized UserPreference model.
 * Replaces legacy preferredBrandIds/preferredStyleIds string arrays.
 */

export async function getPreferences(userId: number) {
  const prefs = await prisma.userPreference.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  return {
    brandIds: prefs.filter((p) => p.preferenceType === "brand").map((p) => p.externalId),
    styleIds: prefs.filter((p) => p.preferenceType === "style").map((p) => p.externalId),
  };
}

export async function setPreferences(
  userId: number,
  brandIds: string[],
  styleIds: string[]
) {
  await prisma.$transaction([
    prisma.userPreference.deleteMany({ where: { userId } }),
    ...brandIds.map((id) =>
      prisma.userPreference.create({
        data: { userId, preferenceType: "brand" as PreferenceType, externalId: id },
      })
    ),
    ...styleIds.map((id) =>
      prisma.userPreference.create({
        data: { userId, preferenceType: "style" as PreferenceType, externalId: id },
      })
    ),
    prisma.user.update({
      where: { id: userId },
      data: { onboardingDone: true },
    }),
  ]);
}
