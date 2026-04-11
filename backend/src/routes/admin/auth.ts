import { Hono } from "hono";
import { z } from "zod";
import { setCookie, getCookie } from "hono/cookie";
import { validateAdminInitData } from "../../lib/admin-auth.js";
import { createAdminSessionToken, getAdminSessionCookieName, verifyAdminSessionToken } from "../../lib/admin-session.js";

const app = new Hono();

// ── POST /auth ────────────────────────────────────────────
app.post("/auth", async (c) => {
  // Browser admin session
  const cookieToken = getCookie(c, getAdminSessionCookieName());
  if (verifyAdminSessionToken(cookieToken)) {
    return c.json({ ok: true, user: { id: 0, first_name: "Browser Admin" } });
  }

  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ initData: z.string() }).safeParse(body);
  if (!parsed.success) return c.json({ error: "Body must include initData (string)" }, 400);

  const initData = parsed.data.initData?.trim() ?? "";

  if (process.env.NODE_ENV === "development" && !initData) {
    const host = c.req.header("host") ?? "";
    if (host.includes("localhost") || host.startsWith("127.0.0.1")) {
      return c.json({ ok: true, user: { id: 0, first_name: "Local Dev" } });
    }
  }

  if (!initData) return c.json({ error: "initData is required", reason: "missing_init_data" }, 401);

  const result = validateAdminInitData(initData);
  if (!result.ok) return c.json({ error: "Unauthorized", reason: result.reason }, 401);

  return c.json({ ok: true, user: result.user });
});

// ── POST /login ───────────────────────────────────────────
const loginSchema = z.object({ password: z.string() });

app.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Body must include password (string)" }, 400);

  const password = parsed.data.password.trim();
  const expected = (process.env.ADMIN_PANEL_PASSWORD || "").replace(/\r\n?|\n/g, "").trim();
  if (!expected || password !== expected) return c.json({ error: "Unauthorized" }, 401);

  const token = createAdminSessionToken();
  if (!token) return c.json({ error: "Server misconfigured", reason: "missing_admin_panel_secret" }, 500);

  setCookie(c, getAdminSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  return c.json({ ok: true });
});

// ── POST /logout ──────────────────────────────────────────
app.post("/logout", async (c) => {
  setCookie(c, getAdminSessionCookieName(), "", {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return c.json({ ok: true });
});

export { app as adminAuthRoutes };
