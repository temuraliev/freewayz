import { NextRequest, NextResponse } from "next/server";
import { validateAdminInitData } from "@backend/auth/admin-auth";
import { getAdminSessionCookieName, verifyAdminSessionToken } from "@backend/auth/admin-session";
import { z } from "zod";

const bodySchema = z.object({ initData: z.string() });

export async function POST(request: NextRequest) {
  // 1) Browser admin session (cookie) — allows admin panel outside Telegram
  const cookieToken = request.cookies.get(getAdminSessionCookieName())?.value;
  if (verifyAdminSessionToken(cookieToken)) {
    return NextResponse.json({ ok: true, user: { id: 0, first_name: "Browser Admin" } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body must include initData (string)" }, { status: 400 });
  }

  const initData = parsed.data.initData?.trim() ?? "";

  // Локальная разработка: без Telegram считаем пользователя админом
  if (process.env.NODE_ENV === "development" && !initData) {
    const host = request.headers.get("host") ?? "";
    if (host.includes("localhost") || host.startsWith("127.0.0.1")) {
      return NextResponse.json({
        ok: true,
        user: { id: 0, first_name: "Local Dev" },
      });
    }
  }

  if (!initData) {
    return NextResponse.json(
      { error: "initData is required", reason: "missing_init_data" },
      { status: 401 }
    );
  }

  const result = await validateAdminInitData(initData);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Unauthorized", reason: result.reason },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true, user: result.user });
}
