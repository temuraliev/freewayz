import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@backend/data-source";
import { User } from "@backend/entities/User";
import { LessThan, Not, IsNull } from "typeorm";
import {
  withErrorHandler,
  UnauthorizedError,
  ApiError,
} from "@backend/middleware/with-error-handler";

/**
 * Cron endpoint — sends Telegram reminders to users who abandoned carts.
 *
 * Schedule via vercel.json:
 *   { "crons": [{ "path": "/api/cron/abandoned-carts", "schedule": "0 * * * *" }] }
 *
 * Vercel protects cron routes with `Authorization: Bearer $CRON_SECRET`.
 * Set CRON_SECRET in your Vercel env vars.
 */

const ABANDONED_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

interface CartItem {
  productId: string;
  quantity?: number;
  title?: string;
}

async function sendReminder(
  botToken: string,
  chatId: string,
  firstName: string,
  itemCount: number,
  appUrl: string
) {
  const text =
    `Привет, ${firstName || "клиент"}! 👋\n\n` +
    `Мы заметили, что в твоей корзине остались вещи (артикулов: ${itemCount}). ` +
    `Мы придержали их для тебя, но они могут скоро закончиться. ⏳\n\n` +
    `Загляни в магазин, пока всё в наличии! 👇`;

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: appUrl
        ? {
            inline_keyboard: [
              [{ text: "🛒 Вернуться в корзину", web_app: { url: `${appUrl}/cart` } }],
            ],
          }
        : undefined,
    }),
  });

  return res.ok;
}

export const GET = withErrorHandler(async (request: NextRequest) => {
  // Auth via Vercel cron secret
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    throw new UnauthorizedError();
  }

  const botToken = (process.env.BOT_TOKEN || "").trim();
  if (!botToken) {
    throw new ApiError("BOT_TOKEN not configured", 500, "CONFIG_ERROR");
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
  const cutoff = new Date(Date.now() - ABANDONED_THRESHOLD_MS);

  const ds = await getDataSource();
  const userRepo = ds.getRepository(User);

  const users = await userRepo.find({
    where: {
      cartItems: Not(IsNull()),
      cartUpdatedAt: LessThan(cutoff),
      abandonedCartNotified: false,
    },
    select: {
      id: true,
      telegramId: true,
      firstName: true,
      cartItems: true,
    },
    take: 500, // Hard cap per run to avoid abuse
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const user of users) {
    let items: CartItem[] = [];
    try {
      items = JSON.parse(user.cartItems || "[]");
    } catch {
      skipped++;
      continue;
    }

    if (!items.length) {
      skipped++;
      continue;
    }

    const itemCount = items.reduce((acc, item) => acc + (item.quantity || 1), 0);

    const ok = await sendReminder(
      botToken,
      user.telegramId,
      user.firstName || "",
      itemCount,
      appUrl
    );

    if (ok) {
      await userRepo.update(user.id, { abandonedCartNotified: true });
      sent++;
    } else {
      failed++;
    }

    // Avoid hitting Telegram rate limits
    await new Promise((r) => setTimeout(r, 100));
  }

  return NextResponse.json({
    ok: true,
    total: users.length,
    sent,
    failed,
    skipped,
  });
});
