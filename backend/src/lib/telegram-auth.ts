import crypto from "crypto";

interface TelegramUserData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

interface ValidatedTelegramData {
  user: TelegramUserData;
  authDate: number;
  queryId?: string;
}

/**
 * Validate Telegram WebApp initData using the bot token.
 *
 * Follows the official algorithm:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400
): ValidatedTelegramData | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;

    const entries: string[] = [];
    params.forEach((value, key) => {
      if (key !== "hash") entries.push(`${key}=${value}`);
    });
    entries.sort();
    const dataCheckString = entries.join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    const computedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash))) {
      return null;
    }

    const authDateStr = params.get("auth_date");
    if (!authDateStr) return null;

    const authDate = parseInt(authDateStr, 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > maxAgeSeconds) return null;

    const userStr = params.get("user");
    if (!userStr) return null;

    const user: TelegramUserData = JSON.parse(decodeURIComponent(userStr));

    return { user, authDate, queryId: params.get("query_id") ?? undefined };
  } catch {
    return null;
  }
}
