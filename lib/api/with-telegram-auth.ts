import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram-auth";

type TelegramRouteHandler = (
  req: NextRequest,
  ctx?: { params: Record<string, string> },
  telegramUser?: { id: number; username?: string; first_name?: string }
) => Promise<NextResponse>;

/**
 * Wraps a route handler with Telegram initData validation.
 * Tries customer bot token first, then admin bot token.
 * Returns 401 if validation fails with both tokens.
 */
export function withTelegramAuth(handler: TelegramRouteHandler): (
  req: NextRequest,
  ctx?: { params: Record<string, string> }
) => Promise<NextResponse> {
  return async (req, ctx) => {
    const initData = req.headers.get("X-Telegram-Init-Data") || "";

    if (!initData) {
      return NextResponse.json(
        { error: "Missing Telegram init data", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const customerToken = process.env.BOT_TOKEN || "";
    const adminToken = process.env.ADMIN_BOT_TOKEN || "";

    // Try customer bot token first, fallback to admin bot token
    let result = validateTelegramInitData(initData, customerToken);
    if (!result && adminToken) {
      result = validateTelegramInitData(initData, adminToken);
    }

    if (!result || !result.user) {
      return NextResponse.json(
        { error: "Invalid Telegram authentication", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    return handler(req, ctx, result.user);
  };
}
