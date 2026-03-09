/**
 * PM2 ecosystem config — запуск на сервере всего, чего нет на Vercel.
 *
 * На Vercel: Next.js (Mini App + API), cron (check-suppliers).
 * На сервере (этот конфиг): админ-бот, клиентский бот.
 * Импорт категорий (/importcategory) запускается с сервера как дочерний процесс админ-бота.
 *
 * Использование на сервере:
 *   cd /path/to/Freewayz
 *   npm install
 *   cp .env.example .env.local   # или скопировать свой .env.local
 *   # Заполнить .env.local (BOT_TOKEN, ADMIN_BOT_TOKEN, ADMIN_TELEGRAM_IDS, SANITY_*, и т.д.)
 *   npx pm2 start ecosystem.config.cjs
 *   npx pm2 save && npx pm2 startup   # автозапуск после перезагрузки
 */
module.exports = {
  apps: [
    {
      name: 'admin-bot',
      script: 'scripts/admin-bot/index.mjs',
      cwd: __dirname,
      interpreter: 'node',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'customer-bot',
      script: 'scripts/customer-bot/index.mjs',
      cwd: __dirname,
      interpreter: 'node',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      env: { NODE_ENV: 'production' },
    },
  ],
};
