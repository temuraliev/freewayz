import { validateTelegramInitData } from "./telegram-auth.js";

/**
 * Validate initData and extract user. Returns user on success, null on failure.
 * In development with localhost and empty initData, returns a mock user.
 */
export function validateUserInitData(
  initData: string,
  host?: string | null
): { id: number; first_name: string; username?: string } | null {
  const trimmed = (initData ?? "").trim();

  if (!trimmed) {
    if (
      process.env.NODE_ENV === "development" &&
      host &&
      (host.includes("localhost") || host.startsWith("127.0.0.1"))
    ) {
      return { id: 0, first_name: "Local Dev" };
    }
    return null;
  }

  const botToken = (process.env.BOT_TOKEN || "").replace(/\r\n?|\n/g, "").trim();
  if (!botToken) return null;

  const result = validateTelegramInitData(trimmed, botToken);
  if (!result?.user) return null;

  return result.user;
}
