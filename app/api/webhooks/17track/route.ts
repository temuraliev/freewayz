import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@backend/db";
import {
  parseTrackStatus,
  parseTrackEvents,
  mapTrackStatusToOrderStatus,
  type TrackingEvent,
} from "@backend/integrations/track17";

async function notifyAdminBot(text: string) {
  const botToken = (
    process.env.ADMIN_BOT_TOKEN ||
    process.env.BOT_TOKEN ||
    ""
  )
    .replace(/\r\n?|\n/g, "")
    .trim();
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!botToken || adminIds.length === 0) return;

  for (const chatId of adminIds) {
    fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    }).catch((e) => console.error("17track notify admin:", e));
  }
}

async function notifyCustomer(telegramId: string, text: string) {
  const botToken = (process.env.BOT_TOKEN || process.env.ADMIN_BOT_TOKEN || "")
    .replace(/\r\n?|\n/g, "")
    .trim();
  if (!botToken || !telegramId) return;
  fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: telegramId, text }),
  }).catch(() => {});
}

/**
 * POST /api/webhooks/17track
 *
 * 17track sends push notifications to this endpoint when tracking status changes.
 * Payload structure (v2.2): { event, data: { number, track: { ... } } }
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const payload = body as {
      event?: string;
      data?: {
        number?: string;
        track?: {
          e?: number;
          z1?: Array<{ a: string; b?: string; c: string; d?: string }>;
          z0?: Array<{ a: string; b?: string; c: string; d?: string }>;
        };
      };
    };

    const trackNumber = payload?.data?.number;
    if (!trackNumber) {
      return NextResponse.json({ ok: true, skipped: "no number" });
    }

    const order = await prisma.order.findFirst({
      where: { trackNumber },
      include: { user: { select: { telegramId: true } } },
    });

    if (!order) {
      return NextResponse.json({ ok: true, skipped: "order not found" });
    }

    const track = payload.data?.track;
    const newStatus = track?.e != null ? parseTrackStatus(track.e) : null;
    const rawEvents = track?.z1 || track?.z0 || [];
    const events: TrackingEvent[] = parseTrackEvents(rawEvents);

    const updateData: Record<string, unknown> = {};

    if (newStatus && newStatus !== order.trackingStatus) {
      updateData.trackingStatus = newStatus;
    }

    if (events.length > 0) {
      updateData.trackingEvents = events.map((ev) => ({
        date: ev.date || null,
        status: ev.status,
        description: ev.description,
        location: ev.location,
      }));
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.order.update({ where: { id: order.id }, data: updateData });
    }

    const orderStatus = newStatus ? mapTrackStatusToOrderStatus(newStatus) : null;
    if (orderStatus && orderStatus !== order.status) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: orderStatus as "new" | "paid" | "ordered" | "shipped" | "delivered" | "cancelled" },
      });
    }

    const latestEvent = events[0];
    const eventDesc = latestEvent
      ? `${latestEvent.description}${latestEvent.location ? ` (${latestEvent.location})` : ""}`
      : newStatus || "update";

    await notifyAdminBot(
      `Трекинг #${order.orderId}\n` +
        `Номер: ${trackNumber}\n` +
        `Статус: ${newStatus || "—"}\n` +
        `${eventDesc}`
    );

    if (newStatus === "Delivered") {
      const locationDesc = latestEvent?.location ? `\nАдрес: ${latestEvent.location}` : "";
      await notifyAdminBot(
        `✅ Посылка доставлена\n` +
          `Заказ #${order.orderId}\n` +
          `Трек: ${trackNumber}${locationDesc}`
      );
    }

    const KEY_STATUSES = ["PickedUp", "Delivered"];
    if (newStatus && KEY_STATUSES.includes(newStatus) && order.user?.telegramId) {
      const msgs: Record<string, string> = {
        PickedUp: `Ваша посылка (заказ #${order.orderId}) забрана курьером и в пути!`,
        Delivered: `Ваш заказ #${order.orderId} доставлен! Спасибо за покупку!`,
      };
      if (msgs[newStatus]) {
        await notifyCustomer(order.user.telegramId, msgs[newStatus]);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("17track webhook error:", e);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
