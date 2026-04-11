import { Hono } from "hono";
import { prisma } from "../lib/db.js";
import { sanityClient as sanityReadClient } from "../lib/sanity.js";
import { getSanityClient } from "../lib/sanity.js";

const app = new Hono();

// Cron auth check
function verifyCron(c: { req: { header: (name: string) => string | undefined } }): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret = dev mode
  const auth = c.req.header("authorization");
  return auth === `Bearer ${secret}`;
}

// ── GET /abandoned-carts ──────────────────────────────────
const ABANDONED_THRESHOLD_MS = 2 * 60 * 60 * 1000;

app.get("/abandoned-carts", async (c) => {
  if (!verifyCron(c)) return c.json({ error: "Unauthorized" }, 401);

  const botToken = (process.env.BOT_TOKEN || "").trim();
  if (!botToken) return c.json({ error: "BOT_TOKEN not configured" }, 500);

  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
  const cutoff = new Date(Date.now() - ABANDONED_THRESHOLD_MS);

  const users = await prisma.user.findMany({
    where: { cartItems: { not: null }, cartUpdatedAt: { lt: cutoff }, abandonedCartNotified: false },
    select: { id: true, telegramId: true, firstName: true, cartItems: true },
    take: 500,
  });

  let sent = 0, failed = 0, skipped = 0;

  for (const user of users) {
    let items: { productId: string; quantity?: number }[] = [];
    try { items = JSON.parse(user.cartItems || "[]"); } catch { skipped++; continue; }
    if (!items.length) { skipped++; continue; }

    const itemCount = items.reduce((acc, item) => acc + (item.quantity || 1), 0);
    const text = `Привет, ${user.firstName || "клиент"}! 👋\n\nМы заметили, что в твоей корзине остались вещи (артикулов: ${itemCount}). Мы придержали их для тебя, но они могут скоро закончиться. ⏳\n\nЗагляни в магазин, пока всё в наличии! 👇`;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: user.telegramId, text, parse_mode: "HTML",
        reply_markup: appUrl ? { inline_keyboard: [[{ text: "🛒 Вернуться в корзину", web_app: { url: `${appUrl}/cart` } }]] } : undefined,
      }),
    });

    if (res.ok) {
      await prisma.user.update({ where: { id: user.id }, data: { abandonedCartNotified: true } });
      sent++;
    } else { failed++; }

    await new Promise((r) => setTimeout(r, 100));
  }

  return c.json({ ok: true, total: users.length, sent, failed, skipped });
});

// ── GET /check-suppliers ──────────────────────────────────
app.get("/check-suppliers", async (c) => {
  if (!verifyCron(c)) return c.json({ error: "Unauthorized" }, 401);

  const client = getSanityClient({ useCdn: false, withToken: true });
  const botToken = (process.env.ADMIN_BOT_TOKEN || process.env.BOT_TOKEN || "").replace(/\r\n?|\n/g, "").trim();
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);

  if (!botToken || adminIds.length === 0) return c.json({ ok: true, skipped: "no bot token or admin ids" });

  const suppliers = await client.fetch(`*[_type == "yupooSupplier" && isActive == true]{ _id, name, url, lastAlbumCount, knownAlbumIds }`);
  if (!suppliers?.length) return c.json({ ok: true, checked: 0 });

  let totalNew = 0;

  for (const supplier of suppliers as { _id: string; name: string; url: string; knownAlbumIds?: string[] }[]) {
    try {
      const html = await fetch(supplier.url, { headers: { "User-Agent": "Mozilla/5.0" } }).then((r) => r.text());
      const albumRegex = /href="([^"]*\/albums\/\d+[^"]*)"/g;
      const albumUrls: string[] = [];
      let match;
      while ((match = albumRegex.exec(html)) !== null) {
        const full = match[1].startsWith("http") ? match[1] : new URL(match[1], supplier.url).href;
        if (!albumUrls.includes(full)) albumUrls.push(full);
      }

      const knownIds = new Set(supplier.knownAlbumIds || []);
      const newAlbums = albumUrls.filter((url) => {
        const m = url.match(/\/albums\/(\d+)/);
        return m && !knownIds.has(m[1]);
      });

      totalNew += newAlbums.slice(0, 10).length;

      for (const albumUrl of newAlbums.slice(0, 10)) {
        for (const chatId of adminIds) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: `${supplier.name}: New album\n${albumUrl}` }),
          }).catch(() => {});
        }
        await new Promise((r) => setTimeout(r, 500));
      }

      const allIds = albumUrls.map((u) => u.match(/\/albums\/(\d+)/)?.[1]).filter(Boolean) as string[];
      await client.patch(supplier._id).set({ lastCheckedAt: new Date().toISOString(), lastAlbumCount: albumUrls.length, knownAlbumIds: allIds }).commit();
    } catch (e) {
      console.error(`Supplier check error (${supplier.name}):`, (e as Error).message);
    }
  }

  return c.json({ ok: true, checked: (suppliers as unknown[]).length, newAlbums: totalNew });
});

export { app as cronRoutes };
