import { createClient } from "@sanity/client";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import * as path from "path";
import pc from "picocolors";
import fetch from "node-fetch";

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

const SANITY_PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const SANITY_DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const SANITY_API_TOKEN = (process.env.SANITY_API_TOKEN || "").replace(/\r\n?|\n/g, "").trim();
const BOT_TOKEN = (process.env.BOT_TOKEN || "").replace(/\r\n?|\n/g, "").trim();

if (!SANITY_PROJECT_ID || !SANITY_API_TOKEN || !BOT_TOKEN) {
  console.error(pc.red("Missing credentials in .env.local (Sanity or Bot Token)"));
  process.exit(1);
}

const client = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  apiVersion: "2024-03-01",
  token: SANITY_API_TOKEN,
  useCdn: false,
});

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

  // Find users with non-empty cart, updated more than 2 hours ago, and not yet notified
  // cartItems is stored as a JSON string
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  const query = `*[_type == "user" && defined(cartItems) && cartUpdatedAt < $twoHoursAgo && abandonedCartNotified == false]{
    _id,
    telegramId,
    firstName,
    cartItems
  }`;

  console.log(pc.blue("Fetching candidates..."));
  const users = await client.fetch(query, { twoHoursAgo });

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
      // Mark as notified so we don't spam
      await client
        .patch(user._id)
        .set({ abandonedCartNotified: true })
        .commit();
      sentCount++;
      console.log(pc.green(`  ✔ Sent!`));
    } else {
      console.log(pc.red(`  ✖ Failed.`));
    }

    // Rate limiting for Telegram
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(pc.cyan(`\n=== Report ===`));
  console.log(`Users Notified: ${pc.green(sentCount)}`);
}

main().catch(console.error);
