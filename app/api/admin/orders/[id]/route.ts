import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import { validateAdminInitData } from "@/lib/admin-auth";
import { z } from "zod";

const orderFields = `
  _id,
  orderId,
  total,
  status,
  trackNumber,
  trackUrl,
  carrier,
  track17Registered,
  trackingStatus,
  trackingEvents,
  shippingMethod,
  notes,
  createdAt,
  updatedAt,
  "user": user->{ _id, telegramId, username, firstName },
  items
`;

const bodySchema = z.object({
  initData: z.string(),
  status: z
    .enum(["new", "paid", "ordered", "shipped", "delivered", "cancelled"])
    .optional(),
  trackNumber: z.string().optional(),
  trackUrl: z.string().url().optional().nullable(),
  notes: z.string().optional(),
});

function makeSanityClient() {
  const token = process.env.SANITY_API_TOKEN;
  if (!token) return null;
  return createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
    apiVersion: "2024-01-01",
    useCdn: false,
    token,
  });
}

async function notifyCustomer(
  telegramId: string,
  text: string
) {
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

  const client = makeSanityClient();
  if (!client) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  try {
    const order = await client.fetch(
      `*[_type == "order" && _id == $id][0]{ ${orderFields} }`,
      { id }
    );
    if (!order) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(order);
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

  const client = makeSanityClient();
  if (!client) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.trackNumber !== undefined)
    patch.trackNumber = parsed.data.trackNumber;
  if (parsed.data.trackUrl !== undefined) patch.trackUrl = parsed.data.trackUrl;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;

  try {
    const prev = await client.getDocument(id).catch(() => null);
    await client.patch(id).set(patch).commit();

    if (
      parsed.data.trackNumber &&
      !prev?.track17Registered
    ) {
      const ok = await registerWith17track(parsed.data.trackNumber);
      if (ok) {
        await client.patch(id).set({ track17Registered: true }).commit();
      }
      if (!parsed.data.trackUrl) {
        const url = `https://t.17track.net/en#nums=${encodeURIComponent(parsed.data.trackNumber)}`;
        await client.patch(id).set({ trackUrl: url }).commit();
      }
    }

    const telegramId = prev?.user?._ref
      ? (
          await client
            .fetch(`*[_id == $ref][0]{ telegramId }`, {
              ref: prev.user._ref,
            })
            .catch(() => null)
        )?.telegramId
      : null;

    if (telegramId) {
      const orderId = prev?.orderId ?? id;
      if (parsed.data.status === "shipped") {
        const trackInfo = parsed.data.trackNumber
          ? `\nТрек: ${parsed.data.trackNumber}${parsed.data.trackUrl ? `\n${parsed.data.trackUrl}` : ""}`
          : "";
        await notifyCustomer(
          telegramId,
          `Ваш заказ #${orderId} отправлен!${trackInfo}`
        );
      } else if (parsed.data.status === "delivered") {
        await notifyCustomer(
          telegramId,
          `Ваш заказ #${orderId} доставлен! Спасибо за покупку!`
        );
      } else if (parsed.data.status === "cancelled") {
        await notifyCustomer(
          telegramId,
          `Заказ #${orderId} отменён. Свяжитесь с нами, если есть вопросы.`
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Order patch error:", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
