#!/usr/bin/env node
/**
 * Customer Telegram Bot (grammY).
 * Sends welcome message with catalog/recommendations/profile buttons on /start.
 * Uses BOT_TOKEN (customer-facing bot).
 */
import { Bot, InlineKeyboard } from 'grammy';
import { loadEnvLocal, cleanEnv } from '../lib/env.mjs';

loadEnvLocal();

const token = cleanEnv('BOT_TOKEN');
if (!token) { console.error('BOT_TOKEN not set'); process.exit(1); }

const webAppUrl = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.ADMIN_WEBAPP_URL ||
  ''
).replace(/\r\n?|\n/g, '').trim();

const bot = new Bot(token);

bot.command('start', async (ctx) => {
  const firstName = ctx.from?.first_name || 'друг';
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
  await ctx.reply(
    'Доступные команды:\n' +
    '/start — главное меню\n' +
    '/help — эта справка'
  );
});

async function setupMenuButton() {
  if (!webAppUrl) return;
  try {
    await bot.api.setChatMenuButton({
      menu_button: { type: 'web_app', text: 'Каталог', web_app: { url: webAppUrl } },
    });
  } catch (e) {
    console.error('Failed to set menu button:', e.message);
  }
}

console.log('Starting customer bot...');
setupMenuButton();
bot.start({ onStart: () => console.log('Customer bot is running') });
