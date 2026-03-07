#!/usr/bin/env node
/**
 * Admin Telegram Bot (grammY).
 * Only users listed in ADMIN_TELEGRAM_IDS can use the bot.
 * For a single deployment: set ADMIN_WEBAPP_URL (or NEXT_PUBLIC_APP_URL) to the same URL
 * as your customer Mini App (e.g. https://your-store.vercel.app). Admins will see edit
 * buttons and /admin when opening that URL from either bot.
 */
import { Bot, session } from 'grammy';
import { createClient } from '@sanity/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

function loadEnvLocal() {
  const path = join(PROJECT_ROOT, '.env.local');
  try {
    const content = readFileSync(path, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eq = trimmed.indexOf('=');
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          let value = trimmed.slice(eq + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
            value = value.slice(1, -1);
          process.env[key] = value.replace(/\r$/, '').trim();
        }
      }
    }
  } catch (_) {}
}

loadEnvLocal();

const token = (process.env.ADMIN_BOT_TOKEN || '').replace(/\r\n?|\n/g, '').trim();
const adminIdsStr = (process.env.ADMIN_TELEGRAM_IDS || '').replace(/\r\n?|\n/g, '').trim();
const webAppUrl = (process.env.ADMIN_WEBAPP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();

const adminIds = new Set(
  adminIdsStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseInt(s, 10))
    .filter((n) => !Number.isNaN(n))
);

function isAdmin(userId) {
  return adminIds.size > 0 && adminIds.has(userId);
}

if (!token) {
  console.error('ADMIN_BOT_TOKEN is not set. Create a bot via @BotFather and set it in .env.local');
  process.exit(1);
}

if (adminIds.size === 0) {
  console.warn('ADMIN_TELEGRAM_IDS is empty. No one will be able to use the bot. Set comma-separated Telegram user IDs in .env.local');
}

const sanityToken = (process.env.SANITY_API_TOKEN || '').replace(/\r\n?|\n/g, '').trim();
const sanityClient = sanityToken && process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  ? createClient({
      projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
      dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
      apiVersion: '2024-01-01',
      useCdn: false,
      token: sanityToken,
    })
  : null;

const bot = new Bot(token);

bot.use(session({ initial: () => ({}) }));

bot.use((ctx, next) => {
  const from = ctx.from;
  if (!from) return next();
  if (!isAdmin(from.id)) {
    ctx.reply('Access denied. You are not an admin.').catch(() => {});
    return;
  }
  return next();
});

bot.command('start', async (ctx) => {
  const text =
    'Admin panel. Use the menu or buttons below.\n\n' +
    '/orders — orders\n' +
    '/suppliers — Yupoo suppliers\n' +
    '/expense — add expense\n' +
    '/products — search products';
  const keyboard = webAppUrl
    ? {
        reply_markup: {
          inline_keyboard: [[{ text: 'Open Admin Panel', web_app: { url: webAppUrl } }]],
        },
      }
    : {};
  await ctx.reply(text, keyboard);
});

bot.command('menu', async (ctx) => {
  await ctx.reply('Use /start to see the main menu.');
});

bot.command('products', async (ctx) => {
  const query = ctx.message?.text?.replace(/^\/products\s*/i, '').trim() || '';
  if (!sanityClient) {
    await ctx.reply('Sanity not configured.');
    return;
  }
  if (!query || query.length < 2) {
    await ctx.reply('Usage: /products <search>. Example: /products hoodie');
    return;
  }
  const q = query.replace(/\s+/g, ' ').trim();
  const groq = `*[_type == "product" && (title match $q || brand->title match $q)] | order(_updatedAt desc) [0...10] { _id, title, "slug": slug.current, "brand": brand->title }`;
  try {
    const products = await sanityClient.fetch(groq, { q: `*${q}*` });
    if (!products || products.length === 0) {
      await ctx.reply('Nothing found.');
      return;
    }
    const lines = products.map((p, i) => `${i + 1}. ${p.brand || ''} ${p.title}`.trim());
    const slug = products[0]?.slug?.current;
    const keyboard = webAppUrl && slug
      ? {
          reply_markup: {
            inline_keyboard: [[{ text: 'Open first in panel', web_app: { url: `${webAppUrl}/product/${slug}?edit=1` } }]],
          },
        }
      : {};
    await ctx.reply(lines.join('\n'), keyboard);
  } catch (e) {
    await ctx.reply('Error: ' + (e.message || 'search failed'));
  }
});

bot.command('setprice', async (ctx) => {
  const rest = ctx.message?.text?.replace(/^\/setprice\s+/i, '').trim() || '';
  if (!sanityClient) {
    await ctx.reply('Sanity not configured.');
    return;
  }
  const parts = rest.split(/\s+/);
  const slug = parts[0];
  const price = parts[1] ? parseInt(parts[1], 10) : NaN;
  if (!slug || Number.isNaN(price) || price < 0) {
    await ctx.reply('Usage: /setprice <slug> <price>. Example: /setprice hoodie-sp5der-1 250000');
    return;
  }
  try {
    const doc = await sanityClient.fetch(
      `*[_type == "product" && slug.current == $slug][0]{ _id }`,
      { slug }
    );
    if (!doc?._id) {
      await ctx.reply('Product not found.');
      return;
    }
    await sanityClient.patch(doc._id).set({ price }).commit();
    await ctx.reply(`Price set to ${price} UZS for ${slug}`);
  } catch (e) {
    await ctx.reply('Error: ' + (e.message || 'update failed'));
  }
});

bot.command('orders', async (ctx) => {
  if (!sanityClient) {
    await ctx.reply('Sanity not configured.');
    return;
  }
  try {
    const orders = await sanityClient.fetch(
      `*[_type == "order"] | order(createdAt desc) [0...15] { _id, orderId, total, status, trackNumber }`
    );
    if (!orders?.length) {
      await ctx.reply('No orders yet.');
      return;
    }
    const lines = orders.map((o, i) =>
      `${i + 1}. #${o.orderId} — ${o.status} — ${(o.total || 0).toLocaleString()} UZS${o.trackNumber ? ` · ${o.trackNumber}` : ''}`
    );
    const keyboard = webAppUrl
      ? { reply_markup: { inline_keyboard: [[{ text: 'Open in panel', web_app: { url: `${webAppUrl}/admin/orders` } }]] } }
      : {};
    await ctx.reply(lines.join('\n'), keyboard);
  } catch (e) {
    await ctx.reply('Error: ' + (e.message || 'fetch failed'));
  }
});

bot.command('order', async (ctx) => {
  const arg = ctx.message?.text?.replace(/^\/order\s+/i, '').trim() || '';
  if (!sanityClient) {
    await ctx.reply('Sanity not configured.');
    return;
  }
  if (!arg) {
    await ctx.reply('Usage: /order <orderId>. Example: /order 12345');
    return;
  }
  try {
    const order = await sanityClient.fetch(
      `*[_type == "order" && (orderId == $id || _id == $id)][0]{ _id, orderId, total, status, trackNumber, trackUrl, notes, "user": user->telegramId }`,
      { id: arg }
    );
    if (!order) {
      await ctx.reply('Order not found.');
      return;
    }
    const text =
      `#${order.orderId}\n` +
      `Status: ${order.status}\n` +
      `Total: ${(order.total || 0).toLocaleString()} UZS\n` +
      (order.trackNumber ? `Track: ${order.trackNumber}\n` : '') +
      (order.trackUrl ? `Link: ${order.trackUrl}\n` : '') +
      (order.notes ? `Notes: ${order.notes}` : '');
    const keyboard = webAppUrl
      ? {
          reply_markup: {
            inline_keyboard: [[{ text: 'Open in panel', web_app: { url: `${webAppUrl}/admin/orders` } }]],
          },
        }
      : {};
    await ctx.reply(text, keyboard);
  } catch (e) {
    await ctx.reply('Error: ' + (e.message || 'fetch failed'));
  }
});

bot.command('suppliers', async (ctx) => {
  if (!sanityClient) {
    await ctx.reply('Sanity not configured.');
    return;
  }
  try {
    const list = await sanityClient.fetch(
      `*[_type == "yupooSupplier" && isActive == true] | order(name asc) { name, url, lastAlbumCount }`
    );
    if (!list?.length) {
      await ctx.reply('No suppliers. Add with /addsupplier <url>');
      return;
    }
    const lines = list.map((s) => `${s.name}: ${s.lastAlbumCount ?? '?'} albums`);
    const keyboard = webAppUrl
      ? { reply_markup: { inline_keyboard: [[{ text: 'Open in panel', web_app: { url: `${webAppUrl}/admin/suppliers` } }]] } }
      : {};
    await ctx.reply(lines.join('\n'), keyboard);
  } catch (e) {
    await ctx.reply('Error: ' + (e.message || 'fetch failed'));
  }
});

bot.command('addsupplier', async (ctx) => {
  const url = ctx.message?.text?.replace(/^\/addsupplier\s+/i, '').trim() || '';
  if (!sanityClient) {
    await ctx.reply('Sanity not configured.');
    return;
  }
  if (!url || !url.startsWith('http')) {
    await ctx.reply('Usage: /addsupplier <url>. Example: /addsupplier https://pikachushop.x.yupoo.com/categories/4695853');
    return;
  }
  try {
    const name = url.replace(/^https?:\/\//, '').split('/')[0] || 'Supplier';
    await sanityClient.create({
      _type: 'yupooSupplier',
      name,
      url,
      isActive: true,
    });
    await ctx.reply(`Added supplier: ${name}`);
  } catch (e) {
    await ctx.reply('Error: ' + (e.message || 'create failed'));
  }
});

bot.command('expense', async (ctx) => {
  const rest = ctx.message?.text?.replace(/^\/expense\s+/i, '').trim() || '';
  if (!sanityClient) {
    await ctx.reply('Sanity not configured.');
    return;
  }
  const parts = rest.split(/\s+/);
  const amount = parts[0] ? parseInt(parts[0], 10) : NaN;
  const description = parts.slice(1).join(' ') || 'Expense';
  if (Number.isNaN(amount) || amount <= 0) {
    await ctx.reply('Usage: /expense <amount> <description>. Example: /expense 50000 shipping');
    return;
  }
  try {
    await sanityClient.create({
      _type: 'expense',
      date: new Date().toISOString(),
      amount,
      currency: 'UZS',
      category: 'other',
      description,
    });
    await ctx.reply(`Expense recorded: ${amount} UZS — ${description}`);
  } catch (e) {
    await ctx.reply('Error: ' + (e.message || 'create failed'));
  }
});

bot.on('message', async (ctx) => {
  await ctx.reply('Use /start for the menu or open the Admin Panel from the button.');
});

async function setMenuButton() {
  if (!webAppUrl) return;
  try {
    await bot.api.setChatMenuButton({
      menuButton: {
        type: 'web_app',
        text: 'Admin Panel',
        web_app: { url: webAppUrl },
      },
    });
  } catch (e) {
    console.warn('Could not set menu button:', e.message);
  }
}

bot.start().then(() => {
  console.log('Admin bot is running (long polling).');
  setMenuButton();
});

bot.catch((err) => {
  console.error('Bot error:', err);
});
