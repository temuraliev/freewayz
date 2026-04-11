import { validateTelegramInitData } from "./telegram-auth.js";

const adminIdsStr = (process.env.ADMIN_TELEGRAM_IDS || "").replace(/\r\n?|\n/g, "").trim();
const adminIds = new Set(
  adminIdsStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseInt(s, 10))
    .filter((n) => !Number.isNaN(n))
);

export function isAdminTelegramId(userId: number): boolean {
  return adminIds.size > 0 && adminIds.has(userId);
}

export function validateAdminInitData(
  initData: string,
  host?: string | null
):
  | { ok: true; user: { id: number; username?: string; first_name: string } }
  | { ok: false; reason: string } {
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
