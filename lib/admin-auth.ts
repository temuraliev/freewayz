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
 * Validate Telegram WebApp initData from the Admin Mini App (opened via admin bot).
 * Uses ADMIN_BOT_TOKEN and ensures the user is in ADMIN_TELEGRAM_IDS.
 * Returns the validated user payload or null.
 */
export function validateAdminInitData(initData: string): { id: number; username?: string; first_name: string } | null {
  const adminBotToken = process.env.ADMIN_BOT_TOKEN;
  if (!adminBotToken) return null;

  const result = validateTelegramInitData(initData, adminBotToken);
  if (!result || !isAdminTelegramId(result.user.id)) return null;

  return {
    id: result.user.id,
    username: result.user.username,
    first_name: result.user.first_name,
  };
}
