import "server-only";

import type { NextRequest } from "next/server";
import { validateAdminInitData } from "@/lib/admin-auth";
import { getAdminSessionCookieName, verifyAdminSessionToken } from "@/lib/admin-session";

export function isAdminRequest(request: NextRequest, initData?: string | null) {
  // Browser session cookie (admin panel login)
  const cookieToken = request.cookies.get(getAdminSessionCookieName())?.value;
  if (verifyAdminSessionToken(cookieToken)) {
    return { ok: true as const, method: "cookie" as const };
  }

  // Telegram WebApp initData (miniapp)
  const auth = validateAdminInitData(initData ?? "", request.headers.get("host"));
  if (auth.ok) {
    return { ok: true as const, method: "telegram" as const };
  }

  return { ok: false as const, reason: auth.reason };
}

