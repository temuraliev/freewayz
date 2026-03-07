import "server-only";

import { validateTelegramInitData } from "@/lib/telegram-auth";

const adminIdsStr = (process.env.ADMIN_TELEGRAM_IDS || "").replace(/\r\n?|\n/g, "").trim();
const adminIds = new Set(
  adminIdsStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseInt(s, 10))
    .filter((n) => !Number.isNaN(n))
);

/**
 * Check if a Telegram user ID is in the admin list (ADMIN_TELEGRAM_IDS).
 */
export function isAdminTelegramId(userId: number): boolean {
  return adminIds.size > 0 && adminIds.has(userId);
}

/**
 * Validate Telegram WebApp initData and check if user is admin.
 * Accepts initData from either the customer bot (BOT_TOKEN) or the admin bot (ADMIN_BOT_TOKEN),
 * so one deployment works: admins get admin UI when opening the same app URL from any bot.
 * Returns { ok: true, user } if admin, or { ok: false, reason } for debugging.
 */
export function validateAdminInitData(initData: string):
  | { ok: true; user: { id: number; username?: string; first_name: string } }
  | { ok: false; reason: string } {
  if (!initData.trim()) {
    return { ok: false, reason: "missing_init_data" };
  }

  const adminBotToken = (process.env.ADMIN_BOT_TOKEN || "").replace(/\r\n?|\n/g, "").trim();
  const customerBotToken = (process.env.BOT_TOKEN || "").replace(/\r\n?|\n/g, "").trim();

  for (const token of [adminBotToken, customerBotToken]) {
    if (!token) continue;
    const result = validateTelegramInitData(initData, token);
    if (result) {
      if (isAdminTelegramId(result.user.id)) {
        return {
          ok: true,
          user: {
            id: result.user.id,
            username: result.user.username,
            first_name: result.user.first_name,
          },
        };
      }
      return { ok: false, reason: "not_in_admin_list" };
    }
  }

  return { ok: false, reason: "invalid_signature" };
}
