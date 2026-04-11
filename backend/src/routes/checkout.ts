import { Hono } from "hono";
import { checkoutSchema } from "../lib/validations.js";
import { rateLimit } from "../lib/rate-limit.js";
import { logSecurityEvent } from "../lib/security-logger.js";
import { sanityClient } from "../lib/sanity.js";
import { sanitizeInput } from "../lib/sanitize.js";
import { generateCheckoutMessage, getTelegramCheckoutUrl } from "../lib/utils.js";

const app = new Hono();
const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 500 });

app.post("/", async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "unknown";

  const { success, reset } = await limiter.check(5, ip);
  if (!success) {
    logSecurityEvent({ type: "RATE_LIMITED", ip, detail: "/api/checkout" });
    return c.json({ error: "Too many requests. Please try again later." }, 429);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON" }, 400);

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    logSecurityEvent({ type: "VALIDATION_FAILED", ip, detail: JSON.stringify(parsed.error.flatten()) });
    return c.json({ error: "Invalid checkout data", details: parsed.error.flatten() }, 400);
  }

  const { username, items, total } = parsed.data;

  try {
    const productTitles = items.map((item) => item.title);
    const products = await sanityClient.fetch(
      `*[_type == "product" && title in $titles]{ title, price }`,
      { titles: productTitles }
    );

    const priceMap = new Map<string, number>();
    for (const p of products as { title: string; price: number }[]) priceMap.set(p.title, p.price);

    const verifiedItems = items.map((item) => {
      const serverPrice = priceMap.get(item.title);
      if (serverPrice !== undefined && serverPrice !== item.price) {
        logSecurityEvent({ type: "CHECKOUT_PRICE_MISMATCH", ip, detail: `"${item.title}": client=${item.price}, server=${serverPrice}` });
        return { ...item, price: serverPrice };
      }
      return item;
    });

    const verifiedTotal = verifiedItems.reduce((sum, item) => sum + item.price, 0);
    const message = generateCheckoutMessage(sanitizeInput(username), verifiedItems, verifiedTotal);
    const checkoutUrl = getTelegramCheckoutUrl(message);

    return c.json({ ok: true, checkoutUrl, verifiedTotal, priceAdjusted: verifiedTotal !== total });
  } catch (error) {
    console.error("[checkout] Sanity fetch error:", error);
    const message = generateCheckoutMessage(sanitizeInput(username), items, total);
    const checkoutUrl = getTelegramCheckoutUrl(message);
    return c.json({ ok: true, checkoutUrl, verifiedTotal: total, priceAdjusted: false });
  }
});

export { app as checkoutRoutes };
