#!/usr/bin/env node
/**
 * Admin Telegram Bot (grammY).
 * Only users listed in ADMIN_TELEGRAM_IDS can use the bot.
 *
 * CRM data (orders, users, expenses, promos, suppliers) → PostgreSQL via Prisma
 * Product catalog (brands, styles, categories, products) → Sanity (read-only)
 */
import { Bot, session, InlineKeyboard } from 'grammy';
import { loadEnvLocal, cleanEnv } from '../lib/env.mjs';
import { getPrisma } from '../lib/prisma.mjs';
import { getSanityClient } from '../lib/sanity-client.mjs';

// Command modules
import { register as registerOrders } from './commands/orders.mjs';
import { register as registerSuppliers } from './commands/suppliers.mjs';
import { register as registerImport, handleImportText } from './commands/import.mjs';
import { register as registerFinance } from './commands/finance.mjs';
import { register as registerPromo } from './commands/promo.mjs';

loadEnvLocal();

const token = cleanEnv('BOT_TOKEN') || cleanEnv('ADMIN_BOT_TOKEN');
const adminIdsStr = cleanEnv('ADMIN_TELEGRAM_IDS');
const webAppUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.ADMIN_WEBAPP_URL || '').trim().replace(/\/+$/, '');

const adminIds = new Set(
  adminIdsStr.split(',').map((s) => s.trim()).filter(Boolean)
    .map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n))
);

function isAdmin(userId) {
  return adminIds.size > 0 && adminIds.has(userId);
}

if (!token) { console.error('BOT_TOKEN is not set.'); process.exit(1); }
if (adminIds.size === 0) { console.warn('ADMIN_TELEGRAM_IDS is empty.'); }

const prisma = getPrisma();
const sanity = getSanityClient();
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

// Admin gate: allow /start and /help for everyone, block rest for non-admins
bot.use((ctx, next) => {
  const from = ctx.from;
  if (!from) return next();
  const text = ctx.message?.text?.trim() || '';
  if (/^\/(start|help)(@\w+)?(\s.*)?$/i.test(text)) return next();
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

const deps = { prisma, sanity, webAppUrl, notifyAdmins, isAdmin, bot };

// ── /start & /help ─────────────────────────────────────────

const ADMIN_HELP =
  '📋 Справка по командам бота\n\n' +
  '🛒 Заказы\n' +
  '/orders — список последних 15 заказов\n' +
  '/order <orderId> — детали заказа\n' +
  '/neworder @username товар1, товар2 сумма — создать заказ\n' +
  '/track <orderId> <трек-номер> — привязать трек\n' +
  '/confirm <orderId> — подтвердить заказ\n\n' +
  '📦 Поставщики и импорт\n' +
  '/suppliers — список Yupoo-поставщиков\n' +
  '/addsupplier <url> — добавить поставщика\n' +
  '/importcategory <URL> --brand SLUG --style SLUG [опции]\n' +
  '/importqueue — очередь импортов\n' +
  '/importcancel — остановить текущий импорт\n\n' +
  '💰 Финансы\n' +
  '/expense <сумма> <описание>\n\n' +
  '🎟 Промокоды\n' +
  '/promo create CODE TYPE VALUE [maxUses] [maxUsesPerUser]\n' +
  '/promo list — список активных\n' +
  '/promo disable CODE — деактивировать';

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

bot.command('help', async (ctx) => {
  if (isAdmin(ctx.from?.id)) {
    await ctx.reply(ADMIN_HELP);
    return;
  }
  await ctx.reply(
    'Команды бота:\n\n/start — главное меню\n/help — эта справка.'
  );
});

bot.command('menu', async (ctx) => {
  await ctx.reply('Используйте /start');
});

// ── Register command modules ────────────────────────────────

registerOrders(bot, deps);
registerSuppliers(bot, deps);
registerImport(bot, deps);
registerFinance(bot, deps);
registerPromo(bot, deps);

// ── Text handler (delegates to import flow if active) ───────

bot.on('message:text', async (ctx) => {
  const handled = await handleImportText(ctx, deps);
  if (!handled) {
    await ctx.reply('Используйте /start для меню.');
  }
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

export { notifyAdmins, bot, sanity as sanityClient };

bot.start().then(() => {
  console.log('Admin bot is running (long polling).');
  setMenuButton();
});

// Track recent errors to avoid flooding admins with duplicates
const recentErrors = new Map();
const ERROR_DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 min

function shouldNotifyError(key) {
  const now = Date.now();
  const last = recentErrors.get(key);
  // Cleanup old entries
  for (const [k, ts] of recentErrors) {
    if (now - ts > ERROR_DEDUP_WINDOW_MS) recentErrors.delete(k);
  }
  if (last && now - last < ERROR_DEDUP_WINDOW_MS) return false;
  recentErrors.set(key, now);
  return true;
}

bot.catch(async (err) => {
  console.error('Bot error:', err);
  const message = err?.error?.message || err?.message || String(err);
  const stack = err?.error?.stack || err?.stack || '';
  const dedupKey = message.slice(0, 100);

  if (!shouldNotifyError(dedupKey)) return;

  const ctx = err?.ctx;
  const userInfo = ctx?.from
    ? `User: ${ctx.from.id} ${ctx.from.username ? '@' + ctx.from.username : ''}`
    : '';
  const update = ctx?.update?.message?.text ? `Text: ${ctx.update.message.text.slice(0, 100)}` : '';

  const text =
    `🚨 <b>Bot error</b>\n\n` +
    `<code>${message.slice(0, 500)}</code>\n\n` +
    (userInfo ? `${userInfo}\n` : '') +
    (update ? `${update}\n` : '') +
    (stack ? `\n<code>${stack.slice(0, 500)}</code>` : '');

  try {
    await notifyAdmins(text, { parse_mode: 'HTML' });
  } catch (notifyErr) {
    console.error('Failed to notify admins of error:', notifyErr?.message);
  }
});

// Send startup notification
bot.api.getMe().then((me) => {
  console.log(`Bot @${me.username} ready.`);
}).catch(() => {});
