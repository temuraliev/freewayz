import { Context } from "hono";
import { validateAdminInitData } from "./admin-auth.js";
import { getAdminSessionCookieName, verifyAdminSessionToken } from "./admin-session.js";
import { getCookie } from "hono/cookie";

/**
 * Check if a request is from an admin (cookie or Telegram initData).
 * Returns { ok: true } or { ok: false, reason: string }.
 */
export function isAdminRequest(
  c: Context,
  initData?: string | null
): { ok: true; method: "cookie" | "telegram" } | { ok: false; reason: string } {
  // Browser session cookie (admin panel login)
  const cookieToken = getCookie(c, getAdminSessionCookieName());
  if (verifyAdminSessionToken(cookieToken)) {
    return { ok: true, method: "cookie" };
  }

  // Telegram WebApp initData (miniapp)
  const host = c.req.header("host") ?? null;
  const auth = validateAdminInitData(initData ?? "", host);
  if (auth.ok) {
    return { ok: true, method: "telegram" };
  }

  return { ok: false, reason: auth.reason };
}
