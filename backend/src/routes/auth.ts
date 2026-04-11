import { Hono } from "hono";
import { validateTelegramInitData } from "../lib/telegram-auth.js";
import { telegramInitDataSchema } from "../lib/validations.js";
import { rateLimit } from "../lib/rate-limit.js";
import { logSecurityEvent } from "../lib/security-logger.js";

const app = new Hono();

const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 500 });

app.post("/telegram", async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "unknown";

  const { success, remaining, reset } = await limiter.check(10, ip);
  if (!success) {
    logSecurityEvent({ type: "RATE_LIMITED", ip, detail: "/api/auth/telegram" });
    return c.json({ error: "Too many requests. Please try again later." }, 429);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = telegramInitDataSchema.safeParse(body);
  if (!parsed.success) {
    logSecurityEvent({ type: "VALIDATION_FAILED", ip, detail: JSON.stringify(parsed.error.flatten()) });
    return c.json({ error: "initData is required", details: parsed.error.flatten() }, 400);
  }

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    return c.json({ error: "Server configuration error" }, 500);
  }

  const result = validateTelegramInitData(parsed.data.initData, botToken);
  if (!result) {
    logSecurityEvent({ type: "AUTH_FAILED", ip, detail: "Invalid Telegram hash" });
    return c.json({ error: "Invalid or expired Telegram data" }, 401);
  }

  logSecurityEvent({ type: "AUTH_SUCCESS", ip, detail: `user_id=${result.user.id}` });

  return c.json(
    { ok: true, user: result.user, authDate: result.authDate },
    200,
    {
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(reset),
    }
  );
});

export { app as authRoutes };
