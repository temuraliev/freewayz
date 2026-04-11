import { NextResponse } from "next/server";
import { getAdminSessionCookieName } from "@backend/auth/admin-session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: getAdminSessionCookieName(),
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}

