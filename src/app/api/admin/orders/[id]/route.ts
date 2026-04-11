import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@backend/data-source";
import { OrderEntity } from "@backend/entities/Order";
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
  const auth = await validateAdminInitData(initData, request.headers.get("host"));
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ds = await getDataSource();
    const orderRepo = ds.getRepository(OrderEntity);

    // Support lookup by numeric DB id OR by orderId string
    const numericId = parseInt(id, 10);

    const qb = orderRepo
      .createQueryBuilder("o")
      .leftJoinAndSelect("o.user", "u");

    if (isNaN(numericId)) {
      qb.where("o.orderId = :orderId", { orderId: id });
    } else {
      qb.where("(o.id = :numId OR o.orderId = :orderId)", {
        numId: numericId,
        orderId: id,
      });
    }

    const order = await qb.getOne();

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

  const auth = await validateAdminInitData(parsed.data.initData ?? "", request.headers.get("host"));
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ds = await getDataSource();
    const orderRepo = ds.getRepository(OrderEntity);

    const numericId = parseInt(id, 10);

    const qb = orderRepo
      .createQueryBuilder("o")
      .leftJoinAndSelect("o.user", "u");

    if (isNaN(numericId)) {
      qb.where("o.orderId = :orderId", { orderId: id });
    } else {
      qb.where("(o.id = :numId OR o.orderId = :orderId)", {
        numId: numericId,
        orderId: id,
      });
    }

    const prev = await qb.getOne();

    if (!prev) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.trackNumber !== undefined) updateData.trackNumber = parsed.data.trackNumber;
    if (parsed.data.trackUrl !== undefined) updateData.trackUrl = parsed.data.trackUrl;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
    if (parsed.data.cost !== undefined) updateData.cost = parsed.data.cost;

    await orderRepo.update(prev.id, updateData);

    // Register with 17track if new tracking number
    if (parsed.data.trackNumber && !prev.track17Registered) {
      const ok = await registerWith17track(parsed.data.trackNumber);
      if (ok) {
        await orderRepo.update(prev.id, { track17Registered: true });
      }
      if (!parsed.data.trackUrl) {
        const url = `https://t.17track.net/en#nums=${encodeURIComponent(parsed.data.trackNumber)}`;
        await orderRepo.update(prev.id, { trackUrl: url });
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
          message = `\u{1F4B3} \u041E\u043F\u043B\u0430\u0442\u0430 \u0437\u0430\u043A\u0430\u0437\u0430 #${orderId} \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0430! \u0413\u043E\u0442\u043E\u0432\u0438\u043C \u043A \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0435.`;
          break;
        case "ordered":
          message = `\u{1F4E6} \u0417\u0430\u043A\u0430\u0437 #${orderId} \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D \u0438 \u043F\u0435\u0440\u0435\u0434\u0430\u043D \u0432 \u0440\u0430\u0431\u043E\u0442\u0443. \u0421\u043A\u043E\u0440\u043E \u0431\u0443\u0434\u0435\u0442 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D.`;
          break;
        case "shipped": {
          const trackInfo = parsed.data.trackNumber
            ? `\n\n\u0422\u0440\u0435\u043A-\u043D\u043E\u043C\u0435\u0440: ${parsed.data.trackNumber}${parsed.data.trackUrl ? `\n${parsed.data.trackUrl}` : ""}`
            : "";
          message = `\u{1F69A} \u0417\u0430\u043A\u0430\u0437 #${orderId} \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D!${trackInfo}`;
          break;
        }
        case "delivered":
          message = `\u2705 \u0417\u0430\u043A\u0430\u0437 #${orderId} \u0434\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D! \u0421\u043F\u0430\u0441\u0438\u0431\u043E \u0437\u0430 \u043F\u043E\u043A\u0443\u043F\u043A\u0443 \u{1F64C}`;
          break;
        case "cancelled":
          message = `\u274C \u0417\u0430\u043A\u0430\u0437 #${orderId} \u043E\u0442\u043C\u0435\u043D\u0451\u043D. \u0415\u0441\u043B\u0438 \u0435\u0441\u0442\u044C \u0432\u043E\u043F\u0440\u043E\u0441\u044B \u2014 \u043D\u0430\u043F\u0438\u0448\u0438 \u043D\u0430\u043C.`;
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
