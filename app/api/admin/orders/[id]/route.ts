import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@backend/db";
import { validateAdminInitData } from "@backend/auth/admin-auth";
import { z } from "zod";

const bodySchema = z.object({
  initData: z.string(),
  status: z
    .enum(["new", "paid", "ordered", "shipped", "delivered", "cancelled"])
    .optional(),
  trackNumber: z.string().optional(),
  trackUrl: z.string().url().optional().nullable(),
  notes: z.string().optional(),
  cost: z.number().min(0).optional().nullable(),
});

async function notifyCustomer(telegramId: string, text: string) {
  const botToken = (
    process.env.BOT_TOKEN ||
    process.env.ADMIN_BOT_TOKEN ||
    ""
  )
    .replace(/\r\n?|\n/g, "")
    .trim();
  if (!botToken || !telegramId) return;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: telegramId, text }),
  }).catch((e) => console.error("Notify customer:", e));
}

async function registerWith17track(trackNumber: string) {
  const apiKey = (process.env.TRACK17_API_KEY || "").trim();
  if (!apiKey) return false;
  try {
    const res = await fetch("https://api.17track.net/track/v2.2/register", {
      method: "POST",
      headers: {
        "17token": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ number: trackNumber }]),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const auth = validateAdminInitData(initData, request.headers.get("host"));
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Support lookup by numeric DB id OR by orderId string
    const numericId = parseInt(id, 10);
    const order = await prisma.order.findFirst({
      where: isNaN(numericId)
        ? { orderId: id }
        : { OR: [{ id: numericId }, { orderId: id }] },
      include: {
        user: {
          select: { id: true, telegramId: true, username: true, firstName: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...order,
      user: order.user ?? null,
    });
  } catch (e) {
    console.error("Order fetch error:", e);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const auth = validateAdminInitData(parsed.data.initData ?? "", request.headers.get("host"));
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const numericId = parseInt(id, 10);
    const prev = await prisma.order.findFirst({
      where: isNaN(numericId)
        ? { orderId: id }
        : { OR: [{ id: numericId }, { orderId: id }] },
      include: { user: { select: { telegramId: true } } },
    });

    if (!prev) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.trackNumber !== undefined) updateData.trackNumber = parsed.data.trackNumber;
    if (parsed.data.trackUrl !== undefined) updateData.trackUrl = parsed.data.trackUrl;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
    if (parsed.data.cost !== undefined) updateData.cost = parsed.data.cost;

    await prisma.order.update({ where: { id: prev.id }, data: updateData });

    // Register with 17track if new tracking number
    if (parsed.data.trackNumber && !prev.track17Registered) {
      const ok = await registerWith17track(parsed.data.trackNumber);
      if (ok) {
        await prisma.order.update({
          where: { id: prev.id },
          data: { track17Registered: true },
        });
      }
      if (!parsed.data.trackUrl) {
        const url = `https://t.17track.net/en#nums=${encodeURIComponent(parsed.data.trackNumber)}`;
        await prisma.order.update({ where: { id: prev.id }, data: { trackUrl: url } });
      }
    }

    // Notify customer when status actually changes
    const telegramId = prev.user?.telegramId ?? null;
    const newStatus = parsed.data.status;
    const statusChanged = newStatus && newStatus !== prev.status;

    if (telegramId && statusChanged) {
      const orderId = prev.orderId;
      let message: string | null = null;

      switch (newStatus) {
        case "paid":
          message = `💳 Оплата заказа #${orderId} получена! Готовим к отправке.`;
          break;
        case "ordered":
          message = `📦 Заказ #${orderId} подтверждён и передан в работу. Скоро будет отправлен.`;
          break;
        case "shipped": {
          const trackInfo = parsed.data.trackNumber
            ? `\n\nТрек-номер: ${parsed.data.trackNumber}${parsed.data.trackUrl ? `\n${parsed.data.trackUrl}` : ""}`
            : "";
          message = `🚚 Заказ #${orderId} отправлен!${trackInfo}`;
          break;
        }
        case "delivered":
          message = `✅ Заказ #${orderId} доставлен! Спасибо за покупку 🙌`;
          break;
        case "cancelled":
          message = `❌ Заказ #${orderId} отменён. Если есть вопросы — напиши нам.`;
          break;
      }

      if (message) {
        await notifyCustomer(telegramId, message);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Order patch error:", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
