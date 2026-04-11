import { getDataSource } from "@backend/data-source";
import { UserPreference, PreferenceType } from "@backend/entities/UserPreference";
import { User } from "@backend/entities/User";

/**
 * User preferences service using normalized UserPreference model.
 * Replaces legacy preferredBrandIds/preferredStyleIds string arrays.
 */

export async function getPreferences(userId: number) {
  const ds = await getDataSource();
  const prefRepo = ds.getRepository(UserPreference);

  const prefs = await prefRepo.find({
    where: { userId },
    order: { createdAt: "ASC" },
  });

  return {
    brandIds: prefs.filter((p) => p.preferenceType === PreferenceType.BRAND).map((p) => p.externalId),
    styleIds: prefs.filter((p) => p.preferenceType === PreferenceType.STYLE).map((p) => p.externalId),
  };
}

export async function setPreferences(
  userId: number,
  brandIds: string[],
  styleIds: string[]
) {
  const ds = await getDataSource();

  await ds.transaction(async (manager) => {
    const prefRepo = manager.getRepository(UserPreference);
    const userRepo = manager.getRepository(User);

    await prefRepo.delete({ userId });

    for (const id of brandIds) {
      const pref = prefRepo.create({
        userId,
        preferenceType: PreferenceType.BRAND,
        externalId: id,
      });
      await prefRepo.save(pref);
    }

    for (const id of styleIds) {
      const pref = prefRepo.create({
        userId,
        preferenceType: PreferenceType.STYLE,
        externalId: id,
      });
      await prefRepo.save(pref);
    }

    await userRepo.update(userId, { onboardingDone: true });
  });
}
