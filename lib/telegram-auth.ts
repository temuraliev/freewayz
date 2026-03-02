import "server-only";

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
 *
 * 1. Parse the URL-encoded initData string
 * 2. Sort all params (except `hash`) alphabetically
 * 3. Compute HMAC-SHA256( data_check_string, secret_key )
 *    where secret_key = HMAC-SHA256( bot_token, "WebAppData" )
 * 4. Compare with the provided hash
 * 5. Optionally reject if auth_date is too old
 */
export function validateTelegramInitData(
    initData: string,
    botToken: string,
    maxAgeSeconds = 86400 // 24 hours
): ValidatedTelegramData | null {
    try {
        const params = new URLSearchParams(initData);
        const hash = params.get("hash");

        if (!hash) return null;

        // Build the data-check-string (sorted key=value pairs, excluding hash)
        const entries: string[] = [];
        params.forEach((value, key) => {
            if (key !== "hash") {
                entries.push(`${key}=${value}`);
            }
        });
        entries.sort();
        const dataCheckString = entries.join("\n");

        // Compute the secret key
        const secretKey = crypto
            .createHmac("sha256", "WebAppData")
            .update(botToken)
            .digest();

        // Compute the hash
        const computedHash = crypto
            .createHmac("sha256", secretKey)
            .update(dataCheckString)
            .digest("hex");

        // Constant-time comparison to prevent timing attacks
        if (!crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash))) {
            return null;
        }

        // Check auth_date freshness
        const authDateStr = params.get("auth_date");
        if (!authDateStr) return null;

        const authDate = parseInt(authDateStr, 10);
        const now = Math.floor(Date.now() / 1000);
        if (now - authDate > maxAgeSeconds) {
            return null; // initData is too old
        }

        // Parse user object
        const userStr = params.get("user");
        if (!userStr) return null;

        const user: TelegramUserData = JSON.parse(decodeURIComponent(userStr));

        return {
            user,
            authDate,
            queryId: params.get("query_id") ?? undefined,
        };
    } catch {
        return null;
    }
}
