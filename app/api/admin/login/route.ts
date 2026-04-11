import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createAdminSessionToken,
  getAdminSessionCookieName,
} from "@backend/auth/admin-session";

const bodySchema = z.object({ password: z.string() });

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body must include password (string)" }, { status: 400 });
  }

  const password = parsed.data.password.trim();
  const expected = (process.env.ADMIN_PANEL_PASSWORD || "").replace(/\r\n?|\n/g, "").trim();

  if (!expected || password !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = createAdminSessionToken();
  if (!token) {
    return NextResponse.json(
      { error: "Server misconfigured", reason: "missing_admin_panel_secret" },
      { status: 500 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: getAdminSessionCookieName(),
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return res;
}

