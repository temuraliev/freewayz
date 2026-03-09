/**
 * PM2 ecosystem config — один бот на сервере (админ + клиенты).
 *
 * На Vercel: Next.js (Mini App + API), cron.
 * На сервере: один процесс admin-bot (по /start админам — меню, остальным — приветствие и кнопки).
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
  ],
};
