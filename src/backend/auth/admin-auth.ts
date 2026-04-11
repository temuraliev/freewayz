import "server-only";

import { validateTelegramInitData } from "@backend/auth/telegram-auth";
import { getDataSource } from "@backend/data-source";
import { User } from "@backend/entities/User";
import { UserRole } from "@backend/entities/UserRole";

/**
 * Check if a Telegram user ID has admin role in the DB.
 */
export async function isAdminTelegramId(telegramUserId: number): Promise<boolean> {
  try {
    const ds = await getDataSource();
    const user = await ds.getRepository(User).findOne({
      where: { telegramId: String(telegramUserId) },
      select: ["id"],
    });
    if (!user) return false;

    const role = await ds.getRepository(UserRole).findOne({
      where: { userId: user.id, role: "admin" },
    });
    return !!role;
  } catch (e) {
    console.error("isAdminTelegramId error:", e);
    return false;
  }
}

/**
 * Get all admin Telegram IDs from the DB.
 * Used for sending notifications to admins via Telegram bot.
 */
export async function getAdminTelegramIds(): Promise<string[]> {
  try {
    const ds = await getDataSource();
    const rows = await ds
      .getRepository(UserRole)
      .createQueryBuilder("r")
      .innerJoin("r.user", "u")
      .select("u.telegramId", "telegramId")
      .where("r.role = :role", { role: "admin" })
      .getRawMany<{ telegramId: string }>();

    return rows.map((r) => r.telegramId).filter(Boolean);
  } catch (e) {
    console.error("getAdminTelegramIds error:", e);
    return [];
  }
}

/**
 * Validate Telegram WebApp initData and check if user is admin.
 * In development, when host is localhost and initData is empty, returns admin (for local testing).
 */
export async function validateAdminInitData(
  initData: string,
  host?: string | null
): Promise<
  | { ok: true; user: { id: number; username?: string; first_name: string } }
  | { ok: false; reason: string }
> {
  const trimmed = (initData ?? "").trim();

  if (!trimmed) {
    if (
      process.env.NODE_ENV === "development" &&
      host &&
      (host.includes("localhost") || host.startsWith("127.0.0.1"))
    ) {
      return { ok: true, user: { id: 0, first_name: "Local Dev" } };
    }
    return { ok: false, reason: "missing_init_data" };
  }

  const adminBotToken = (process.env.ADMIN_BOT_TOKEN || "").replace(/\r\n?|\n/g, "").trim();
  const customerBotToken = (process.env.BOT_TOKEN || "").replace(/\r\n?|\n/g, "").trim();

  for (const token of [adminBotToken, customerBotToken]) {
    if (!token) continue;
    const result = validateTelegramInitData(trimmed, token);
    if (result) {
      const isAdmin = await isAdminTelegramId(result.user.id);
      if (isAdmin) {
        return {
          ok: true,
          user: {
            id: result.user.id,
            username: result.user.username,
            first_name: result.user.first_name,
          },
        };
      }
      return { ok: false, reason: "not_admin" };
    }
  }

  return { ok: false, reason: "invalid_signature" };
}
