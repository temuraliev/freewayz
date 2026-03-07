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
  notes,
  createdAt,
  "user": user->{ telegramId, username }
`;

const bodySchema = z.object({
  initData: z.string().min(1),
  status: z.enum(["new", "paid", "ordered", "shipped", "delivered", "cancelled"]).optional(),
  trackNumber: z.string().optional(),
  trackUrl: z.string().url().optional().nullable(),
  notes: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const initData = request.headers.get("X-Telegram-Init-Data");
  if (!initData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = validateAdminInitData(initData);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.SANITY_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const client = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
    apiVersion: "2024-01-01",
    useCdn: false,
    token,
  });

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

  const user = validateAdminInitData(parsed.data.initData);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.SANITY_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const client = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
    apiVersion: "2024-01-01",
    useCdn: false,
    token,
  });

  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.trackNumber !== undefined) patch.trackNumber = parsed.data.trackNumber;
  if (parsed.data.trackUrl !== undefined) patch.trackUrl = parsed.data.trackUrl;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;

  try {
    const prev = await client.getDocument(id).catch(() => null);
    await client.patch(id).set(patch).commit();

    if (parsed.data.status === "shipped" && prev?.user?._ref) {
      const userDoc = await client.fetch(
        `*[_id == $ref][0]{ telegramId }`,
        { ref: prev.user._ref }
      );
      const telegramId = userDoc?.telegramId;
      const trackInfo = parsed.data.trackNumber
        ? ` Трек: ${parsed.data.trackNumber}${parsed.data.trackUrl ? `\n${parsed.data.trackUrl}` : ""}`
        : "";
      if (telegramId && process.env.BOT_TOKEN) {
        const botToken = process.env.BOT_TOKEN.replace(/\r\n?|\n/g, "").trim();
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramId,
            text: `Ваш заказ #${prev?.orderId ?? id} отправлен!${trackInfo}`,
          }),
        }).catch((e) => console.error("Notify customer:", e));
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Order patch error:", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
