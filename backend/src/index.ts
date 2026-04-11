import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";

// Route imports
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/user.js";
import { checkoutRoutes } from "./routes/checkout.js";
import { ordersRoutes } from "./routes/orders.js";
import { productsRoutes } from "./routes/products.js";
import { promoRoutes } from "./routes/promo.js";
import { crossSellRoutes } from "./routes/cross-sell.js";
import { recommendationsRoutes } from "./routes/recommendations.js";
import { cronRoutes } from "./routes/cron.js";
import { webhooksRoutes } from "./routes/webhooks.js";
import { adminRoutes } from "./routes/admin/index.js";

const app = new Hono();

// ── Global middleware ──────────────────────────────────────
app.use("*", logger());

// CORS — allow frontend origin
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim());

app.use(
  "*",
  cors({
    origin: allowedOrigins,
    credentials: true,
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Telegram-Init-Data",
      "X-Idempotency-Key",
    ],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })
);

// ── Global error handler ──────────────────────────────────
app.onError((err, c) => {
  console.error(`[API Error] ${c.req.method} ${c.req.path}:`, err);

  if (err instanceof ApiError) {
    return c.json({ error: err.message, code: err.code }, err.statusCode as 400);
  }

  // Zod validation errors
  if (err && typeof err === "object" && "issues" in err) {
    return c.json({ error: "Validation failed", code: "VALIDATION_ERROR" }, 400);
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  return c.json({ error: message, code: "INTERNAL_ERROR" }, 500);
});

// ── Health check ──────────────────────────────────────────
app.get("/health", (c) => c.json({ ok: true, timestamp: new Date().toISOString() }));

// ── Mount routes ──────────────────────────────────────────
app.route("/api/auth", authRoutes);
app.route("/api/user", userRoutes);
app.route("/api/checkout", checkoutRoutes);
app.route("/api/orders", ordersRoutes);
app.route("/api/products", productsRoutes);
app.route("/api/promo", promoRoutes);
app.route("/api/cross-sell", crossSellRoutes);
app.route("/api/recommendations", recommendationsRoutes);
app.route("/api/cron", cronRoutes);
app.route("/api/webhooks", webhooksRoutes);
app.route("/api/admin", adminRoutes);

// ── Start server ──────────────────────────────────────────
const port = parseInt(process.env.PORT || "4000", 10);

serve({ fetch: app.fetch, port }, () => {
  console.log(`🚀 FreeWayz API running on http://localhost:${port}`);
});

// ── Error classes (exported for route handlers) ───────────
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = "INTERNAL_ERROR"
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ValidationError extends ApiError {
  constructor(message = "Validation failed") {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export { app };
