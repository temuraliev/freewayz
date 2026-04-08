/**
 * PM2 ecosystem config — один бот на сервере.
 *
 * На Vercel: Next.js (Mini App + API), cron.
 * На сервере: bot — обслуживает и клиентов (каталог, профиль), и админов (CRM команды).
 * Роль определяется по ADMIN_TELEGRAM_IDS: админы видят CRM меню, остальные — каталог.
 */
module.exports = {
  apps: [
    {
      name: 'bot',
      script: 'scripts/admin-bot/index.mjs',
      cwd: __dirname,
      interpreter: 'node',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      env: { NODE_ENV: 'production' },
    },
  ],
};
