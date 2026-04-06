import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  verifyAdminSessionToken,
  getAdminSessionCookieName,
} from "@/lib/admin-session";

type AdminRouteHandler = (
  req: NextRequest,
  ctx?: { params: Record<string, string> }
) => Promise<NextResponse>;

/**
 * Wraps a route handler with admin session authentication.
 * Returns 401 if the admin session cookie is missing or invalid.
 * Uses HMAC-based token from admin-session.ts.
 */
export function withAdminAuth(handler: AdminRouteHandler): AdminRouteHandler {
  return async (req, ctx) => {
    const cookieStore = await cookies();
    const cookieName = getAdminSessionCookieName();
    const session = cookieStore.get(cookieName);

    if (!session?.value) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    if (!verifyAdminSessionToken(session.value)) {
      return NextResponse.json(
        { error: "Invalid or expired session", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    return handler(req, ctx);
  };
}
