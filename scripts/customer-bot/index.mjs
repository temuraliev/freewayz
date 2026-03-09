#!/usr/bin/env node
/**
 * Customer Telegram Bot (grammY).
 * Sends welcome message with catalog/recommendations/profile buttons on /start.
 * Uses BOT_TOKEN (customer-facing bot).
 */
import { Bot, InlineKeyboard } from 'grammy';
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

const token = (process.env.BOT_TOKEN || '').replace(/\r\n?|\n/g, '').trim();
if (!token) {
  console.error('BOT_TOKEN not set');
  process.exit(1);
}

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
    {
      reply_markup: kb,
      parse_mode: undefined,
    }
  );
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    'Доступные команды:\n' +
    '/start — главное меню\n' +
    '/help — эта справка'
  );
});

// Set menu button to open catalog
async function setupMenuButton() {
  if (!webAppUrl) return;
  try {
    await bot.api.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: 'Каталог',
        web_app: { url: webAppUrl },
      },
    });
    console.log('Menu button set to:', webAppUrl);
  } catch (e) {
    console.error('Failed to set menu button:', e.message);
  }
}

console.log('Starting customer bot...');
setupMenuButton();
bot.start({
  onStart: () => console.log('Customer bot is running'),
});
