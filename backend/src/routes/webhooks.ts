import { Hono } from "hono";
import crypto from "crypto";
import { prisma } from "../lib/db.js";
import { parseTrackStatus, parseTrackEvents, mapTrackStatusToOrderStatus, type TrackingEvent } from "../lib/track17.js";

const app = new Hono();

// ── POST /17track ─────────────────────────────────────────
app.post("/17track", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON" }, 400);

  try {
    const payload = body as {
      event?: string;
      data?: {
        number?: string;
        track?: { e?: number; z1?: Array<{ a: string; b?: string; c: string; d?: string }>; z0?: Array<{ a: string; b?: string; c: string; d?: string }> };
      };
    };

    const trackNumber = payload?.data?.number;
    if (!trackNumber) return c.json({ ok: true, skipped: "no number" });

    const order = await prisma.order.findFirst({ where: { trackNumber }, include: { user: { select: { telegramId: true } } } });
    if (!order) return c.json({ ok: true, skipped: "order not found" });

    const track = payload.data?.track;
    const newStatus = track?.e != null ? parseTrackStatus(track.e) : null;
    const rawEvents = track?.z1 || track?.z0 || [];
    const events: TrackingEvent[] = parseTrackEvents(rawEvents);

    const updateData: Record<string, unknown> = {};
    if (newStatus && newStatus !== order.trackingStatus) updateData.trackingStatus = newStatus;
    if (events.length > 0) updateData.trackingEvents = events.map((ev) => ({ date: ev.date || null, status: ev.status, description: ev.description, location: ev.location }));
    if (Object.keys(updateData).length > 0) await prisma.order.update({ where: { id: order.id }, data: updateData });

    const orderStatus = newStatus ? mapTrackStatusToOrderStatus(newStatus) : null;
    if (orderStatus && orderStatus !== order.status) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: orderStatus as "new" | "paid" | "ordered" | "shipped" | "delivered" | "cancelled" },
      });
    }

    // Notify admins and customers
    const botToken = (process.env.ADMIN_BOT_TOKEN || process.env.BOT_TOKEN || "").replace(/\r\n?|\n/g, "").trim();
    const adminIds = (process.env.ADMIN_TELEGRAM_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const latestEvent = events[0];
    const eventDesc = latestEvent ? `${latestEvent.description}${latestEvent.location ? ` (${latestEvent.location})` : ""}` : newStatus || "update";

    if (botToken && adminIds.length > 0) {
      const text = `Трекинг #${order.orderId}\nНомер: ${trackNumber}\nСтатус: ${newStatus || "—"}\n${eventDesc}`;
      for (const chatId of adminIds) {
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text }),
        }).catch(() => {});
      }
    }

    const KEY_STATUSES = ["PickedUp", "Delivered"];
    if (newStatus && KEY_STATUSES.includes(newStatus) && order.user?.telegramId) {
      const msgs: Record<string, string> = {
        PickedUp: `Ваша посылка (заказ #${order.orderId}) забрана курьером и в пути!`,
        Delivered: `Ваш заказ #${order.orderId} доставлен! Спасибо за покупку!`,
      };
      if (msgs[newStatus]) {
        const custBotToken = (process.env.BOT_TOKEN || botToken).replace(/\r\n?|\n/g, "").trim();
        if (custBotToken) {
          fetch(`https://api.telegram.org/bot${custBotToken}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: order.user.telegramId, text: msgs[newStatus] }),
          }).catch(() => {});
        }
      }
    }

    return c.json({ ok: true });
  } catch (e) {
    console.error("17track webhook error:", e);
    return c.json({ error: "Processing failed" }, 500);
  }
});

// ── POST /sanity ──────────────────────────────────────────
app.post("/sanity", async (c) => {
  const rawBody = await c.req.text();
  const secret = process.env.SANITY_WEBHOOK_SECRET;

  if (secret) {
    const sig = c.req.header("sanity-webhook-signature") || c.req.header("x-sanity-signature");
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    try {
      const ok = sig && (
        crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(`sha256=${expected}`)) ||
        crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
      );
      if (!ok) return c.json({ error: "Invalid signature" }, 401);
    } catch { return c.json({ error: "Invalid signature" }, 401); }
  }

  let payload: { _id: string; _type: string; deleted?: boolean };
  try { payload = JSON.parse(rawBody); } catch { return c.json({ ok: false, error: "Invalid JSON" }, 400); }

  const { _id, _type, deleted } = payload;
  if (!_id || !_type) return c.json({ ok: false, error: "Missing _id/_type" }, 400);

  const cleanId = _id.replace(/^drafts\./, "");
  let deletedCount = 0;

  if (deleted) {
    if (_type === "brand" || _type === "style") {
      const result = await prisma.userPreference.deleteMany({ where: { externalId: cleanId, preferenceType: _type as "brand" | "style" } });
      deletedCount += result.count;

      if (_type === "brand") {
        const users = await prisma.user.findMany({ where: { preferredBrandIds: { has: cleanId } }, select: { id: true, preferredBrandIds: true } });
        for (const u of users) await prisma.user.update({ where: { id: u.id }, data: { preferredBrandIds: u.preferredBrandIds.filter((id) => id !== cleanId) } });
        deletedCount += users.length;
      } else {
        const users = await prisma.user.findMany({ where: { preferredStyleIds: { has: cleanId } }, select: { id: true, preferredStyleIds: true } });
        for (const u of users) await prisma.user.update({ where: { id: u.id }, data: { preferredStyleIds: u.preferredStyleIds.filter((id) => id !== cleanId) } });
        deletedCount += users.length;
      }
    } else if (_type === "product") {
      const cart = await prisma.cartItem.deleteMany({ where: { productId: cleanId } });
      const wish = await prisma.wishlistItem.deleteMany({ where: { productId: cleanId } });
      deletedCount += cart.count + wish.count;
    }
  }

  return c.json({ ok: true, type: _type, id: cleanId, deletedCount });
});

export { app as webhooksRoutes };
