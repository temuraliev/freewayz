import crypto from "crypto";

const COOKIE_NAME = "fwz_admin";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function getSecret(): string {
  const secret = (process.env.ADMIN_PANEL_SECRET || "").replace(/\r\n?|\n/g, "").trim();
  if (!secret) return "";
  return secret;
}

function hmac(secret: string, value: string): string {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function getAdminSessionCookieName() {
  return COOKIE_NAME;
}

export function createAdminSessionToken(nowMs = Date.now()): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const ts = String(nowMs);
  const sig = hmac(secret, ts);
  return `${ts}.${sig}`;
}

export function verifyAdminSessionToken(token: string | undefined | null, nowMs = Date.now()): boolean {
  const secret = getSecret();
  if (!secret) return false;
  const t = (token || "").trim();
  if (!t) return false;

  const [tsStr, sig] = t.split(".");
  if (!tsStr || !sig) return false;
  if (!/^\d+$/.test(tsStr)) return false;

  const ts = Number(tsStr);
  if (!Number.isFinite(ts)) return false;
  if (nowMs - ts > SESSION_TTL_MS) return false;
  if (ts > nowMs + 1000 * 60) return false;

  const expected = hmac(secret, tsStr);
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}
