/**
 * PM2 ecosystem config — два бота на сервере.
 *
 * На Vercel: Next.js (Mini App + API), cron.
 * На сервере: admin-bot (CRM, заказы, импорт) + customer-bot (каталог, профиль).
 * Импорт категорий (/importcategory) запускается с сервера как дочерний процесс.
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
