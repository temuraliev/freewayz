import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import * as path from "path";
import pc from "picocolors";
import fetch from "node-fetch";
import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..");

// Load .env.local
try {
  const cont = readFileSync(path.join(PROJECT_ROOT, ".env.local"), "utf8");
  cont
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .forEach((l) => {
      const eq = l.indexOf("=");
      if (eq > 0)
        process.env[l.slice(0, eq).trim()] = l
          .slice(eq + 1)
          .replace(/["']/g, "")
          .trim();
    });
} catch (e) {}

const BOT_TOKEN = (process.env.BOT_TOKEN || "").replace(/\r\n?|\n/g, "").trim();

if (!process.env.DATABASE_URL || !BOT_TOKEN) {
  console.error(pc.red("Missing DATABASE_URL or BOT_TOKEN in .env.local"));
  process.exit(1);
}

const prisma = new PrismaClient();

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "🛒 Вернуться в корзину", url: `https://t.me/free_wayz_bot/shop` }
          ]]
        }
      }),
    });
    return res.ok;
  } catch (err) {
    console.error(`Failed to send message to ${chatId}:`, err.message);
    return false;
  }
}

async function main() {
  console.log(pc.cyan("=== Freewayz: Abandoned Cart Recovery ==="));

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  console.log(pc.blue("Fetching candidates..."));
  const users = await prisma.user.findMany({
    where: {
      cartItems: { not: null },
      cartUpdatedAt: { lt: twoHoursAgo },
      abandonedCartNotified: false,
    },
    select: { id: true, telegramId: true, firstName: true, cartItems: true },
  });

  console.log(pc.green(`Found ${users.length} potential abandoned carts.`));

  let sentCount = 0;

  for (const user of users) {
    let items = [];
    try {
      items = JSON.parse(user.cartItems);
    } catch (e) { continue; }

    if (!items || items.length === 0) continue;

    const itemCount = items.reduce((acc, item) => acc + (item.quantity || 1), 0);
    const firstName = user.firstName || "клиент";

    const message = `Привет, ${firstName}! 👋\n\nМы заметили, что в твоей корзине остались вещи (артикулов: ${itemCount}). Мы придержали их для тебя, но они могут скоро закончиться. ⏳\n\nЗагляни в магазин, пока всё в наличии! 👇`;

    console.log(`Sending reminder to ${user.telegramId} (${firstName})...`);
    const success = await sendTelegramMessage(user.telegramId, message);

    if (success) {
      await prisma.user.update({
        where: { id: user.id },
        data: { abandonedCartNotified: true },
      });
      sentCount++;
      console.log(pc.green(`  ✔ Sent!`));
    } else {
      console.log(pc.red(`  ✖ Failed.`));
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(pc.cyan(`\n=== Report ===`));
  console.log(`Users Notified: ${pc.green(sentCount)}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
