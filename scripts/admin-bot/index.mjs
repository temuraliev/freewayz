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
 *  /importcategory <url> ... — add Yupoo category import to queue (runs one by one)
 *  /importqueue — show import queue and current job
 *
 * Callback queries handle the interactive Yupoo import flow.
 */
import { Bot, session, InlineKeyboard } from 'grammy';
import { createClient } from '@sanity/client';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

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
const webAppUrl = (process.env.ADMIN_WEBAPP_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');

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
  const text = ctx.message?.text?.trim() || '';
  const isStartOrHelp = /^\/(start|help)(@\w+)?(\s.*)?$/i.test(text);
  if (isStartOrHelp) return next();
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

// ── /start (один бот: админам — админ-меню, остальным — приветствие и кнопки каталога) ─

bot.command('start', async (ctx) => {
  const from = ctx.from;
  if (isAdmin(from?.id)) {
    const text =
      'Панель администратора\n\n' +
      '/orders — заказы\n' +
      '/neworder — создать заказ\n' +
      '/track — привязать трек-номер\n' +
      '/confirm — подтвердить заказ\n' +
      '/suppliers — поставщики Yupoo\n' +
      '/importcategory — импорт категории Yupoo\n' +
      '/expense — записать расход\n' +
      '/promo — управление промокодами';
    const keyboard = webAppUrl
      ? { reply_markup: { inline_keyboard: [[{ text: 'Открыть панель', web_app: { url: webAppUrl } }]] } }
      : {};
    await ctx.reply(text, keyboard);
    return;
  }
  const firstName = from?.first_name || 'друг';
  const kb = new InlineKeyboard();
  if (webAppUrl) {
    kb.webApp('Каталог', webAppUrl).row();
    kb.webApp('Рекомендации для тебя', `${webAppUrl}/recommendations`).row();
    kb.webApp('Мой профиль', `${webAppUrl}/profile`);
  }
  await ctx.reply(
    `Привет, ${firstName}! Добро пожаловать в FreeWayz\n\n` +
    'Андеграунд стритвир премиум-класса.\n' +
    'Бренды: SP5DER, Denim Tears, Hellstar, Protect London и другие.\n\n' +
    'Выбирай из каталога или посмотри персональные рекомендации:',
    { reply_markup: kb, parse_mode: undefined }
  );
});

const ADMIN_HELP = (
  '📋 Справка по командам бота\n\n' +
  '🛒 Заказы\n' +
  '/orders — список последних 15 заказов (номер, статус, сумма, трек).\n' +
  'Пример: /orders\n\n' +
  '/order <orderId> — детали заказа (клиент, товары, трек, заметки).\n' +
  'Пример: /order 42\n' +
  'Пример: /order ORDER-abc123\n\n' +
  '/neworder @username товар1, товар2 сумма — создать заказ вручную.\n' +
  'Пример: /neworder @ivan худи sp5der, футболка denim tears 990000\n\n' +
  '/track <orderId> <трек-номер> — привязать трек к заказу.\n' +
  'Пример: /track 42 1Z999AA10123456784\n\n' +
  '/confirm <orderId> — перевести заказ в статус «заказан».\n' +
  'Пример: /confirm 42\n\n' +
  '📦 Поставщики и импорт\n' +
  '/suppliers — список Yupoo-поставщиков.\n' +
  'Пример: /suppliers\n\n' +
  '/addsupplier <url> — добавить поставщика по URL магазина.\n' +
  'Пример: /addsupplier https://tophotfashion.x.yupoo.com\n\n' +
  '/importcategory <URL> --brand SLUG --style SLUG [опции] — добавить импорт категории в очередь. Выполняется по одному.\n' +
  'Опции: --tier top|ultimate, --from N, --to M, --min-image-size KB, --category SLUG, --ai, --publish\n' +
  'Пример: /importcategory https://tophotfashion.x.yupoo.com/categories/4644883 --brand chrome-hearts --style opium --tier top --from 1 --to 50 --min-image-size 100 --ai\n\n' +
  '/importqueue — показать очередь импортов и текущую задачу.\n' +
  'Пример: /importqueue\n' +
  '/importqueue remove <N> — удалить N-ю задачу из очереди.\n' +
  'Пример: /importqueue remove 2\n' +
  '/importqueue clear — очистить очередь ожидания (текущий импорт не трогает).\n' +
  'Пример: /importqueue clear\n\n' +
  '/importcancel — остановить текущий импорт и перейти к следующему.\n' +
  'Пример: /importcancel\n\n' +
  '💰 Финансы\n' +
  '/expense <сумма> <описание> — записать расход.\n' +
  'Пример: /expense 50000 Доставка из Китая\n\n' +
  '🎟 Промокоды\n' +
  '/promo create CODE TYPE VALUE [maxUses] [maxUsesPerUser] — создать промокод.\n' +
  'TYPE: discount_percent, discount_fixed, balance_topup\n' +
  'Пример: /promo create SUMMER10 discount_percent 10\n' +
  'Пример: /promo create GIFT50K balance_topup 50000 100\n\n' +
  '/promo list — список активных промокодов.\n' +
  'Пример: /promo list\n\n' +
  '/promo disable CODE — отключить промокод.\n' +
  'Пример: /promo disable SUMMER10\n\n' +
  '/start — главное меню с кнопкой панели.'
);

const USER_HELP = (
  'Команды бота:\n\n' +
  '/start — главное меню (каталог, рекомендации, профиль).\n\n' +
  '/help — эта справка.'
);

bot.command('help', async (ctx) => {
  if (isAdmin(ctx.from?.id)) {
    await ctx.reply(ADMIN_HELP);
    return;
  }
  await ctx.reply(USER_HELP);
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

// ── Очередь импортов Yupoo ─────────────────────────────────────────────────

const IMPORT_QUEUE_FILE =
  (process.env.IMPORT_QUEUE_FILE || '').trim() ||
  join(PROJECT_ROOT, '.importqueue.json');

function loadImportQueueState() {
  try {
    if (!existsSync(IMPORT_QUEUE_FILE)) return { queue: [], runningJob: null };
    const raw = readFileSync(IMPORT_QUEUE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const queue = Array.isArray(parsed?.queue) ? parsed.queue : [];
    const runningJob = parsed?.runningJob && typeof parsed.runningJob === 'object' ? parsed.runningJob : null;
    return { queue, runningJob };
  } catch (e) {
    console.warn('Failed to load import queue state:', e.message || e);
    return { queue: [], runningJob: null };
  }
}

function saveImportQueueState(queue, runningJob) {
  try {
    const dir = IMPORT_QUEUE_FILE.replace(/[\\/][^\\/]+$/, '');
    if (dir && dir !== IMPORT_QUEUE_FILE) {
      try { mkdirSync(dir, { recursive: true }); } catch {}
    }
    const tmp = IMPORT_QUEUE_FILE + '.tmp';
    writeFileSync(tmp, JSON.stringify({ queue, runningJob, savedAt: new Date().toISOString() }, null, 2), 'utf8');
    writeFileSync(IMPORT_QUEUE_FILE, readFileSync(tmp, 'utf8'), 'utf8');
  } catch (e) {
    console.warn('Failed to save import queue state:', e.message || e);
  }
}

const state = loadImportQueueState();
const importQueue = Array.isArray(state.queue) ? state.queue : [];
let importRunning = null;

// If bot restarted mid-import, put that job back to the front of the queue.
if (state.runningJob) {
  importQueue.unshift({ ...state.runningJob, requeuedAfterRestart: true, requeuedAt: new Date().toISOString() });
}
saveImportQueueState(importQueue, null);

function runNextImport() {
  if (importRunning || importQueue.length === 0) return;

  const job = importQueue.shift();
  const { url, brand, style, category, from, to, tier, ai, publish, minImageSize } = job;

  const scriptPath = join(PROJECT_ROOT, 'scripts', 'import-yupoo-to-sanity.mjs');
  const spawnArgs = [
    scriptPath,
    url,
    '--brand', brand,
    '--style', style,
    '--tier', tier,
    '--from', String(from),
    '--to', String(to),
  ];
  if (category) spawnArgs.push('--category', category);
  if (minImageSize != null && minImageSize > 0) spawnArgs.push('--min-image-size', String(minImageSize));
  if (ai) spawnArgs.push('--ai');
  if (publish) spawnArgs.push('--publish');

  let outBuf = '';
  let errBuf = '';

  const child = spawn('node', spawnArgs, {
    cwd: PROJECT_ROOT,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  importRunning = { job, child };
  saveImportQueueState(importQueue, job);

  child.stdout?.on('data', (chunk) => { outBuf += chunk.toString(); });
  child.stderr?.on('data', (chunk) => { errBuf += chunk.toString(); });

  child.on('exit', (code, signal) => {
    const wasCancelled = !!importRunning?.job?.cancelled;
    const tail = (s, n = 800) => s.length > n ? '...\n' + s.slice(-n) : s;
    const errTail = tail(errBuf.trim() || outBuf.trim());
    if (wasCancelled) {
      notifyAdmins(`Импорт остановлен админом.\nURL: ${url}\n\n${errTail}`).catch(() => {});
    } else if (code === 0) {
      notifyAdmins(`Импорт завершён.\nURL: ${url}\nБренд: ${brand}, стиль: ${style}\nКод: 0.\n\n${errTail}`).catch(() => {});
    } else {
      notifyAdmins(`Импорт с ошибкой (код ${code}${signal ? `, ${signal}` : ''}).\nURL: ${url}\n\n${errTail}`).catch(() => {});
    }
    importRunning = null;
    saveImportQueueState(importQueue, null);
    runNextImport();
  });

  child.on('error', (err) => {
    notifyAdmins(`Импорт: не удалось запустить — ${err.message}`).catch(() => {});
    importRunning = null;
    saveImportQueueState(importQueue, null);
    runNextImport();
  });
}

// ── /importcategory — добавить импорт в очередь ─────────────────────────────

bot.command('importcategory', async (ctx) => {
  const raw = ctx.message?.text?.replace(/^\/importcategory\s+/i, '').trim() || '';
  if (!raw) {
    await ctx.reply(
      'Импорт категории Yupoo (очередь).\n\n' +
      'Использование:\n' +
      '/importcategory <URL> --brand SLUG --style SLUG [--tier top|ultimate] [--from N] [--to M] [--min-image-size KB] [--ai] [--publish]\n\n' +
      'Пример:\n' +
      '/importcategory https://... --brand x --style y --from 1 --to 50 --min-image-size 100 --ai\n\n' +
      '/importqueue — показать очередь'
    );
    return;
  }

  const args = raw.split(/\s+/);
  let url = null;
  let brand = null;
  let style = null;
  let category = null;
  let from = 1;
  let to = 20;
  let tier = 'ultimate';
  let minImageSize = null;
  let ai = false;
  let publish = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('http') && args[i].includes('yupoo')) {
      url = args[i];
    } else if (args[i] === '--brand' && args[i + 1]) {
      brand = args[i + 1].trim();
      i++;
    } else if (args[i] === '--style' && args[i + 1]) {
      style = args[i + 1].trim();
      i++;
    } else if (args[i] === '--category' && args[i + 1]) {
      category = args[i + 1].trim();
      i++;
    } else if (args[i] === '--tier' && args[i + 1]) {
      tier = args[i + 1].trim().toLowerCase();
      i++;
    } else if (args[i] === '--min-image-size' && args[i + 1]) {
      const n = parseInt(args[i + 1], 10);
      minImageSize = Number.isNaN(n) ? null : Math.max(0, n);
      i++;
    } else if (args[i] === '--from' && args[i + 1]) {
      from = parseInt(args[i + 1], 10) || 1;
      i++;
    } else if (args[i] === '--to' && args[i + 1]) {
      to = parseInt(args[i + 1], 10) || 20;
      i++;
    } else if (args[i] === '--ai') {
      ai = true;
    } else if (args[i] === '--publish') {
      publish = true;
    }
  }

  if (!url || !brand || !style) {
    await ctx.reply('Нужны: URL категории Yupoo, --brand SLUG и --style SLUG. Опционально: --tier top|ultimate --from N --to M --ai --publish --category SLUG');
    return;
  }

  if (tier !== 'top' && tier !== 'ultimate') {
    await ctx.reply('--tier должен быть "top" или "ultimate" (по умолчанию: ultimate)');
    return;
  }

  const job = { url, brand, style, category, from, to, tier, minImageSize, ai, publish };
  importQueue.push(job);
  saveImportQueueState(importQueue, importRunning?.job || null);
  const pos = importQueue.length;
  const running = importRunning ? 1 : 0;

  const minImg = minImageSize != null ? `, мин. фото: ${minImageSize} KB` : '';
  await ctx.reply(
    `Добавлено в очередь. Позиция: ${pos} (в очереди: ${importQueue.length}, выполняется: ${running}).\n` +
    `${brand} / ${style}, ${from}–${to}, tier: ${tier}${minImg}${ai ? ', ИИ' : ''}. Уведомлю по окончании.`
  );

  runNextImport();
});

// ── /importqueue — управление очередью импортов ─────────────────────────────
// /importqueue                — показать очередь
// /importqueue remove <N>     — удалить N-ю задачу из очереди
// /importqueue clear          — очистить очередь

bot.command('importqueue', async (ctx) => {
  const rest = ctx.message?.text?.replace(/^\/importqueue(\s+)?/i, '').trim() || '';
  const parts = rest.split(/\s+/).filter(Boolean);
  const sub = (parts[0] || '').toLowerCase();

  if (sub === 'clear') {
    const removed = importQueue.length;
    importQueue.length = 0;
    saveImportQueueState(importQueue, importRunning?.job || null);
    await ctx.reply(`Очередь очищена. Удалено задач: ${removed}.`);
    return;
  }

  if (sub === 'remove') {
    const n = parts[1] ? parseInt(parts[1], 10) : NaN;
    if (Number.isNaN(n) || n < 1 || n > importQueue.length) {
      await ctx.reply(
        'Использование:\n' +
        '/importqueue remove <N>\n\n' +
        `Сейчас в очереди: ${importQueue.length}\n` +
        'Пример: /importqueue remove 2'
      );
      return;
    }
    const removedJob = importQueue.splice(n - 1, 1)[0];
    saveImportQueueState(importQueue, importRunning?.job || null);
    await ctx.reply(
      `Удалено из очереди (#${n}):\n` +
      `${removedJob.brand} / ${removedJob.style} — ${removedJob.url} (${removedJob.from}–${removedJob.to})`
    );
    return;
  }

  const running = importRunning
    ? `Выполняется:\n${importRunning.job.url}\n${importRunning.job.brand} / ${importRunning.job.style} (${importRunning.job.from}–${importRunning.job.to})\n\n`
    : '';
  const list = importQueue.length === 0
    ? 'Очередь пуста.'
    : importQueue.map((j, i) => `${i + 1}. ${j.brand} / ${j.style} — ${j.url} (${j.from}–${j.to})`).join('\n');
  await ctx.reply(running + 'Очередь:\n' + list);
});

// ── /importcancel — остановить текущий импорт ───────────────────────────────

bot.command('importcancel', async (ctx) => {
  if (!importRunning?.child) {
    await ctx.reply('Сейчас нет активного импорта.');
    return;
  }

  const { job, child } = importRunning;
  job.cancelled = true;
  saveImportQueueState(importQueue, job);

  // Try graceful stop first
  const pid = child.pid;
  try { child.kill('SIGTERM'); } catch {}

  // Force kill if still running after 5s
  setTimeout(() => {
    if (importRunning?.child?.pid === pid) {
      try { importRunning.child.kill('SIGKILL'); } catch {}
    }
  }, 5000);

  await ctx.reply(
    'Останавливаю текущий импорт…\n' +
    `${job.brand} / ${job.style} — ${job.url}\n` +
    'После остановки запущу следующий из очереди (если есть).'
  );
});

// ── Promo code management ────────────────────────────────────

bot.command('promo', async (ctx) => {
  if (!client) { await ctx.reply('Sanity не настроен.'); return; }
  const rest = ctx.message?.text?.replace(/^\/promo\s+/i, '').trim() || '';
  const parts = rest.split(/\s+/);
  const subCmd = parts[0]?.toLowerCase();

  if (subCmd === 'create') {
    // /promo create CODE TYPE VALUE [maxUses] [maxUsesPerUser]
    const code = parts[1]?.toUpperCase();
    const type = parts[2];
    const value = parseInt(parts[3], 10);
    const maxUses = parts[4] ? parseInt(parts[4], 10) : undefined;
    const maxUsesPerUser = parts[5] ? parseInt(parts[5], 10) : 1;

    const validTypes = ['discount_percent', 'discount_fixed', 'balance_topup'];
    if (!code || !validTypes.includes(type) || isNaN(value) || value <= 0) {
      await ctx.reply(
        'Использование:\n' +
        '/promo create CODE TYPE VALUE [maxUses] [maxUsesPerUser]\n\n' +
        'TYPE: discount_percent, discount_fixed, balance_topup\n' +
        'Пример: /promo create SUMMER10 discount_percent 10\n' +
        'Пример: /promo create GIFT50K balance_topup 50000 100'
      );
      return;
    }

    try {
      const existing = await client.fetch(
        `*[_type == "promoCode" && upper(code) == $code][0]{ _id }`,
        { code }
      );
      if (existing) {
        await ctx.reply(`Промокод ${code} уже существует.`);
        return;
      }

      const doc = {
        _type: 'promoCode',
        code,
        type,
        value,
        isActive: true,
        usedCount: 0,
        maxUsesPerUser,
        usedBy: [],
      };
      if (maxUses) doc.maxUses = maxUses;

      await client.create(doc);

      const typeLabel = type === 'discount_percent'
        ? `${value}%`
        : type === 'discount_fixed'
          ? `${value.toLocaleString()} UZS`
          : `+${value.toLocaleString()} UZS (баланс)`;

      await ctx.reply(
        `Промокод создан:\n` +
        `Код: ${code}\n` +
        `Тип: ${typeLabel}\n` +
        (maxUses ? `Макс. использований: ${maxUses}\n` : 'Без лимита\n') +
        `На пользователя: ${maxUsesPerUser}`
      );
    } catch (e) {
      await ctx.reply('Ошибка: ' + (e.message || 'create failed'));
    }
    return;
  }

  if (subCmd === 'list') {
    try {
      const codes = await client.fetch(
        `*[_type == "promoCode" && isActive == true] | order(code asc) {
          code, type, value, usedCount, maxUses, isActive
        }`
      );
      if (!codes?.length) {
        await ctx.reply('Нет активных промокодов.');
        return;
      }
      const lines = codes.map((c) => {
        const typeLabel = c.type === 'discount_percent'
          ? `${c.value}%`
          : c.type === 'discount_fixed'
            ? `${c.value.toLocaleString()} UZS`
            : `+${c.value.toLocaleString()} UZS (бал.)`;
        const usage = c.maxUses
          ? `${c.usedCount || 0}/${c.maxUses}`
          : `${c.usedCount || 0}/∞`;
        return `${c.code} — ${typeLabel} (${usage})`;
      });
      await ctx.reply('Активные промокоды:\n\n' + lines.join('\n'));
    } catch (e) {
      await ctx.reply('Ошибка: ' + (e.message || 'fetch failed'));
    }
    return;
  }

  if (subCmd === 'disable') {
    const code = parts[1]?.toUpperCase();
    if (!code) {
      await ctx.reply('Использование: /promo disable CODE');
      return;
    }
    try {
      const promo = await client.fetch(
        `*[_type == "promoCode" && upper(code) == $code][0]{ _id, code }`,
        { code }
      );
      if (!promo) {
        await ctx.reply(`Промокод ${code} не найден.`);
        return;
      }
      await client.patch(promo._id).set({ isActive: false }).commit();
      await ctx.reply(`Промокод ${promo.code} деактивирован.`);
    } catch (e) {
      await ctx.reply('Ошибка: ' + (e.message || 'patch failed'));
    }
    return;
  }

  await ctx.reply(
    'Команды промокодов:\n' +
    '/promo create CODE TYPE VALUE — создать\n' +
    '/promo list — список активных\n' +
    '/promo disable CODE — деактивировать'
  );
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
      menuButton: { type: 'web_app', text: 'Каталог', web_app: { url: webAppUrl } },
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
