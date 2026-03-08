#!/usr/bin/env node
/**
 * Admin Telegram Bot (grammY).
 * Only users listed in ADMIN_TELEGRAM_IDS can use the bot.
 *
 * Commands:
 *  /start        — main menu
 *  /orders       — list recent orders
 *  /order <id>   — show order details
 *  /neworder     — create an order manually
 *  /track <orderId> <trackNum> — attach tracking number
 *  /confirm <orderId> — confirm (new → ordered)
 *  /suppliers    — list Yupoo suppliers
 *  /addsupplier  — add a new supplier
 *  /expense      — record an expense
 *
 * Callback queries handle the interactive Yupoo import flow.
 */
import { Bot, session, InlineKeyboard } from 'grammy';
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
const webAppUrl = (process.env.ADMIN_WEBAPP_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();

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
  console.error('ADMIN_BOT_TOKEN is not set.');
  process.exit(1);
}

if (adminIds.size === 0) {
  console.warn('ADMIN_TELEGRAM_IDS is empty. No one will be able to use the bot.');
}

const sanityToken = (process.env.SANITY_API_TOKEN || '').replace(/\r\n?|\n/g, '').trim();
const client = sanityToken && process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  ? createClient({
      projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
      dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
      apiVersion: '2024-01-01',
      useCdn: false,
      token: sanityToken,
    })
  : null;

const bot = new Bot(token);

bot.use(session({
  initial: () => ({
    importAlbumUrl: null,
    importSupplierId: null,
    importBrandId: null,
    importStyleId: null,
    state: null,
  }),
}));

bot.use((ctx, next) => {
  const from = ctx.from;
  if (!from) return next();
  if (!isAdmin(from.id)) {
    ctx.reply('Access denied.').catch(() => {});
    return;
  }
  return next();
});

// ── Helpers ─────────────────────────────────────────────────

async function notifyAdmins(text, extra = {}) {
  for (const id of adminIds) {
    try {
      await bot.api.sendMessage(id, text, extra);
    } catch (e) {
      console.error(`Failed to notify admin ${id}:`, e.message);
    }
  }
}

async function registerWith17track(trackNumber) {
  const apiKey = (process.env.TRACK17_API_KEY || '').trim();
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.17track.net/track/v2.2/register', {
      method: 'POST',
      headers: {
        '17token': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ number: trackNumber }]),
    });
    const data = await res.json();
    return data;
  } catch (e) {
    console.error('17track register error:', e.message);
    return null;
  }
}

// ── /start ──────────────────────────────────────────────────

bot.command('start', async (ctx) => {
  const text =
    'Панель администратора\n\n' +
    '/orders — заказы\n' +
    '/neworder — создать заказ\n' +
    '/track — привязать трек-номер\n' +
    '/confirm — подтвердить заказ\n' +
    '/suppliers — поставщики Yupoo\n' +
    '/expense — записать расход';
  const keyboard = webAppUrl
    ? { reply_markup: { inline_keyboard: [[{ text: 'Открыть панель', web_app: { url: webAppUrl } }]] } }
    : {};
  await ctx.reply(text, keyboard);
});

bot.command('menu', async (ctx) => {
  await ctx.reply('Используйте /start');
});

// ── /orders ─────────────────────────────────────────────────

bot.command('orders', async (ctx) => {
  if (!client) { await ctx.reply('Sanity не настроен.'); return; }
  try {
    const orders = await client.fetch(
      `*[_type == "order"] | order(createdAt desc) [0...15] { _id, orderId, total, status, trackNumber }`
    );
    if (!orders?.length) { await ctx.reply('Заказов нет.'); return; }
    const lines = orders.map((o, i) =>
      `${i + 1}. #${o.orderId} — ${o.status} — ${(o.total || 0).toLocaleString()} UZS${o.trackNumber ? ` · ${o.trackNumber}` : ''}`
    );
    const keyboard = webAppUrl
      ? { reply_markup: { inline_keyboard: [[{ text: 'Открыть в панели', web_app: { url: `${webAppUrl}/admin/orders` } }]] } }
      : {};
    await ctx.reply(lines.join('\n'), keyboard);
  } catch (e) {
    await ctx.reply('Ошибка: ' + (e.message || 'fetch failed'));
  }
});

// ── /order <id> ─────────────────────────────────────────────

bot.command('order', async (ctx) => {
  const arg = ctx.message?.text?.replace(/^\/order\s+/i, '').trim() || '';
  if (!client) { await ctx.reply('Sanity не настроен.'); return; }
  if (!arg) { await ctx.reply('Использование: /order <orderId>'); return; }
  try {
    const order = await client.fetch(
      `*[_type == "order" && (orderId == $id || _id == $id)][0]{
        _id, orderId, total, status, trackNumber, trackUrl, trackingStatus, notes,
        "user": user->{ telegramId, username },
        "items": items[]{ title, brand, size, price, quantity }
      }`,
      { id: arg }
    );
    if (!order) { await ctx.reply('Заказ не найден.'); return; }
    let text = `#${order.orderId}\n` +
      `Статус: ${order.status}\n` +
      `Сумма: ${(order.total || 0).toLocaleString()} UZS\n`;
    if (order.user?.username) text += `Клиент: @${order.user.username}\n`;
    if (order.trackNumber) text += `Трек: ${order.trackNumber}\n`;
    if (order.trackingStatus) text += `17track: ${order.trackingStatus}\n`;
    if (order.trackUrl) text += `Ссылка: ${order.trackUrl}\n`;
    if (order.notes) text += `Заметки: ${order.notes}\n`;
    if (order.items?.length) {
      text += '\nТовары:\n';
      order.items.forEach((it, i) => {
        text += `  ${i + 1}. ${it.brand || ''} ${it.title} — ${it.size || ''} — ${(it.price || 0).toLocaleString()} UZS x${it.quantity || 1}\n`;
      });
    }
    const kb = new InlineKeyboard();
    if (webAppUrl) kb.webApp('Открыть в панели', `${webAppUrl}/admin/orders/${order._id}`);
    await ctx.reply(text.trim(), kb.inline_keyboard?.length ? { reply_markup: kb } : {});
  } catch (e) {
    await ctx.reply('Ошибка: ' + (e.message || 'fetch failed'));
  }
});

// ── /neworder @username items total ─────────────────────────

bot.command('neworder', async (ctx) => {
  if (!client) { await ctx.reply('Sanity не настроен.'); return; }
  const rest = ctx.message?.text?.replace(/^\/neworder\s+/i, '').trim() || '';
  if (!rest) {
    await ctx.reply(
      'Использование: /neworder @username товар1, товар2 сумма\n' +
      'Пример: /neworder @ivan hoodie sp5der, tee denim tears 990000'
    );
    return;
  }

  const parts = rest.split(/\s+/);
  const usernameRaw = parts[0]?.startsWith('@') ? parts[0].slice(1) : parts[0];
  const totalStr = parts[parts.length - 1];
  const total = parseInt(totalStr, 10);
  if (Number.isNaN(total) || total <= 0) {
    await ctx.reply('Последний аргумент должен быть суммой (число).');
    return;
  }
  const itemsText = parts.slice(1, -1).join(' ');
  const itemNames = itemsText.split(',').map((s) => s.trim()).filter(Boolean);
  if (itemNames.length === 0) {
    await ctx.reply('Укажите хотя бы один товар.');
    return;
  }

  try {
    let userDoc = await client.fetch(
      `*[_type == "user" && username == $u][0]{ _id }`,
      { u: usernameRaw }
    );
    if (!userDoc) {
      userDoc = await client.create({
        _type: 'user',
        telegramId: `manual-${Date.now()}`,
        username: usernameRaw,
        firstName: usernameRaw,
        status: 'ROOKIE',
        totalSpent: 0,
        cashbackBalance: 0,
      });
    }

    const orderId = `M${Date.now().toString(36).toUpperCase()}`;
    const items = itemNames.map((name) => ({
      _key: `k${Math.random().toString(36).slice(2, 8)}`,
      _type: 'orderItem',
      title: name,
      brand: '',
      size: 'One Size',
      color: '',
      price: Math.round(total / itemNames.length),
      quantity: 1,
    }));

    await client.create({
      _type: 'order',
      orderId,
      user: { _type: 'reference', _ref: userDoc._id },
      items,
      total,
      status: 'new',
      createdAt: new Date().toISOString(),
    });

    await ctx.reply(`Заказ #${orderId} создан для @${usernameRaw} на ${total.toLocaleString()} UZS`);
  } catch (e) {
    await ctx.reply('Ошибка: ' + (e.message || 'create failed'));
  }
});

// ── /track <orderId> <trackNumber> ──────────────────────────

bot.command('track', async (ctx) => {
  if (!client) { await ctx.reply('Sanity не настроен.'); return; }
  const rest = ctx.message?.text?.replace(/^\/track\s+/i, '').trim() || '';
  const parts = rest.split(/\s+/);
  if (parts.length < 2) {
    await ctx.reply('Использование: /track <orderId> <трек-номер>');
    return;
  }
  const [orderIdArg, trackNum] = parts;
  try {
    const order = await client.fetch(
      `*[_type == "order" && (orderId == $id || _id == $id)][0]{ _id, orderId, status }`,
      { id: orderIdArg }
    );
    if (!order) { await ctx.reply('Заказ не найден.'); return; }

    const trackUrl = `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`;
    await client.patch(order._id).set({
      trackNumber: trackNum,
      trackUrl,
      updatedAt: new Date().toISOString(),
    }).commit();

    let statusMsg = `Трек ${trackNum} привязан к заказу #${order.orderId}`;

    const reg = await registerWith17track(trackNum);
    if (reg) {
      await client.patch(order._id).set({ track17Registered: true }).commit();
      statusMsg += '\n17track: зарегистрирован для отслеживания';
    }

    if (order.status === 'ordered' || order.status === 'paid') {
      await client.patch(order._id).set({ status: 'shipped' }).commit();
      statusMsg += '\nСтатус обновлён на: shipped';
    }

    await ctx.reply(statusMsg);
  } catch (e) {
    await ctx.reply('Ошибка: ' + (e.message || 'update failed'));
  }
});

// ── /confirm <orderId> ──────────────────────────────────────

bot.command('confirm', async (ctx) => {
  if (!client) { await ctx.reply('Sanity не настроен.'); return; }
  const arg = ctx.message?.text?.replace(/^\/confirm\s+/i, '').trim() || '';
  if (!arg) { await ctx.reply('Использование: /confirm <orderId>'); return; }
  try {
    const order = await client.fetch(
      `*[_type == "order" && (orderId == $id || _id == $id)][0]{ _id, orderId, status }`,
      { id: arg }
    );
    if (!order) { await ctx.reply('Заказ не найден.'); return; }
    if (order.status !== 'new' && order.status !== 'paid') {
      await ctx.reply(`Заказ #${order.orderId} уже в статусе: ${order.status}`);
      return;
    }
    await client.patch(order._id).set({
      status: 'ordered',
      updatedAt: new Date().toISOString(),
    }).commit();
    await ctx.reply(`Заказ #${order.orderId} подтверждён (ordered)`);
  } catch (e) {
    await ctx.reply('Ошибка: ' + (e.message || 'update failed'));
  }
});

// ── /suppliers ──────────────────────────────────────────────

bot.command('suppliers', async (ctx) => {
  if (!client) { await ctx.reply('Sanity не настроен.'); return; }
  try {
    const list = await client.fetch(
      `*[_type == "yupooSupplier" && isActive == true] | order(name asc) { name, url, lastAlbumCount }`
    );
    if (!list?.length) { await ctx.reply('Нет поставщиков. Добавьте: /addsupplier <url>'); return; }
    const lines = list.map((s) => `${s.name}: ${s.lastAlbumCount ?? '?'} альбомов`);
    const keyboard = webAppUrl
      ? { reply_markup: { inline_keyboard: [[{ text: 'Открыть в панели', web_app: { url: `${webAppUrl}/admin/suppliers` } }]] } }
      : {};
    await ctx.reply(lines.join('\n'), keyboard);
  } catch (e) {
    await ctx.reply('Ошибка: ' + (e.message || 'fetch failed'));
  }
});

// ── /addsupplier <url> ──────────────────────────────────────

bot.command('addsupplier', async (ctx) => {
  const url = ctx.message?.text?.replace(/^\/addsupplier\s+/i, '').trim() || '';
  if (!client) { await ctx.reply('Sanity не настроен.'); return; }
  if (!url || !url.startsWith('http')) {
    await ctx.reply('Использование: /addsupplier <url>');
    return;
  }
  try {
    const name = url.replace(/^https?:\/\//, '').split('/')[0] || 'Supplier';
    await client.create({
      _type: 'yupooSupplier',
      name,
      url,
      isActive: true,
      knownAlbumIds: [],
    });
    await ctx.reply(`Поставщик добавлен: ${name}`);
  } catch (e) {
    await ctx.reply('Ошибка: ' + (e.message || 'create failed'));
  }
});

// ── /expense <amount> <description> ─────────────────────────

bot.command('expense', async (ctx) => {
  const rest = ctx.message?.text?.replace(/^\/expense\s+/i, '').trim() || '';
  if (!client) { await ctx.reply('Sanity не настроен.'); return; }
  const parts = rest.split(/\s+/);
  const amount = parts[0] ? parseInt(parts[0], 10) : NaN;
  const description = parts.slice(1).join(' ') || 'Расход';
  if (Number.isNaN(amount) || amount <= 0) {
    await ctx.reply('Использование: /expense <сумма> <описание>');
    return;
  }
  try {
    await client.create({
      _type: 'expense',
      date: new Date().toISOString(),
      amount,
      currency: 'UZS',
      category: 'other',
      description,
    });
    await ctx.reply(`Расход записан: ${amount.toLocaleString()} UZS — ${description}`);
  } catch (e) {
    await ctx.reply('Ошибка: ' + (e.message || 'create failed'));
  }
});

// ── Callback queries for Yupoo import flow ──────────────────

bot.callbackQuery(/^import:(.+):(.+)$/, async (ctx) => {
  if (!client) { await ctx.answerCallbackQuery('Sanity не настроен'); return; }
  const supplierId = ctx.match[1];
  const albumId = ctx.match[2];

  const supplier = await client.fetch(
    `*[_type == "yupooSupplier" && _id == $id][0]{ url }`,
    { id: supplierId }
  );
  const baseUrl = supplier?.url?.replace(/\/$/, '') || '';
  const albumUrl = `${baseUrl.split('/categories')[0].split('/albums')[0]}/albums/${albumId}`;

  ctx.session.importAlbumUrl = albumUrl;
  ctx.session.importSupplierId = supplierId;
  ctx.session.state = 'selectBrand';

  const brands = await client.fetch(
    `*[_type == "brand"] | order(title asc) { _id, title }`
  );
  if (!brands?.length) {
    await ctx.reply('Нет брендов в Sanity. Создайте хотя бы один.');
    await ctx.answerCallbackQuery();
    return;
  }

  const kb = new InlineKeyboard();
  for (let i = 0; i < brands.length; i++) {
    kb.text(brands[i].title, `brand:${brands[i]._id}`);
    if ((i + 1) % 3 === 0) kb.row();
  }

  await ctx.reply('Выберите бренд:', { reply_markup: kb });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^brand:(.+)$/, async (ctx) => {
  if (!client) { await ctx.answerCallbackQuery(); return; }
  ctx.session.importBrandId = ctx.match[1];
  ctx.session.state = 'selectStyle';

  const styles = await client.fetch(
    `*[_type == "style"] | order(title asc) { _id, title }`
  );
  if (!styles?.length) {
    await ctx.reply('Нет стилей в Sanity.');
    await ctx.answerCallbackQuery();
    return;
  }

  const kb = new InlineKeyboard();
  for (let i = 0; i < styles.length; i++) {
    kb.text(styles[i].title, `style:${styles[i]._id}`);
    if ((i + 1) % 3 === 0) kb.row();
  }

  await ctx.reply('Выберите стиль:', { reply_markup: kb });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^style:(.+)$/, async (ctx) => {
  ctx.session.importStyleId = ctx.match[1];
  ctx.session.state = 'awaitingSubtype';
  await ctx.reply('Напишите подтип (например: худи, футболка, штаны):');
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^close:(.+)$/, async (ctx) => {
  try { await ctx.deleteMessage(); } catch (_) {}
  await ctx.answerCallbackQuery('Закрыто');
});

// ── Text handler (subtype input for import + fallback) ──────

bot.on('message:text', async (ctx) => {
  if (ctx.session.state === 'awaitingSubtype' && ctx.session.importAlbumUrl) {
    const subtype = ctx.message.text.trim();
    if (!subtype) { await ctx.reply('Напишите подтип:'); return; }

    const { importAlbumUrl, importBrandId, importStyleId } = ctx.session;
    ctx.session.state = null;
    ctx.session.importAlbumUrl = null;

    await ctx.reply(`Импорт запущен...\nАльбом: ${importAlbumUrl}\nПодтип: ${subtype}\n\nЭто может занять 1-2 минуты.`);

    try {
      const { importSingleAlbum } = await import('../lib/yupoo-scraper.mjs');
      const result = await importSingleAlbum({
        albumUrl: importAlbumUrl,
        brandId: importBrandId,
        styleId: importStyleId,
        subtype,
        sanityClient: client,
      });

      if (result?.ok) {
        const kb = new InlineKeyboard();
        if (webAppUrl && result.slug) {
          kb.webApp('Открыть товар', `${webAppUrl}/product/${result.slug}`);
        }
        await ctx.reply(
          `Товар создан: ${result.title || 'Без названия'}\nЦена: ${(result.price || 0).toLocaleString()} UZS`,
          kb.inline_keyboard?.length ? { reply_markup: kb } : {}
        );
      } else {
        await ctx.reply('Не удалось создать товар: ' + (result?.error || 'unknown'));
      }
    } catch (e) {
      console.error('Import error:', e);
      await ctx.reply('Ошибка импорта: ' + (e.message || 'unknown'));
    }
    return;
  }

  await ctx.reply('Используйте /start для меню.');
});

// ── Menu button ─────────────────────────────────────────────

async function setMenuButton() {
  if (!webAppUrl) return;
  try {
    await bot.api.setChatMenuButton({
      menuButton: { type: 'web_app', text: 'Admin Panel', web_app: { url: webAppUrl } },
    });
  } catch (e) {
    console.warn('Could not set menu button:', e.message);
  }
}

// ── Export notifyAdmins for use by other modules ────────────
export { notifyAdmins, bot, client as sanityClient };

bot.start().then(() => {
  console.log('Admin bot is running (long polling).');
  setMenuButton();
});

bot.catch((err) => {
  console.error('Bot error:', err);
});
