/**
 * Yupoo import commands: /importcategory, /importqueue, /importcancel
 * Also handles callback queries for interactive brand/style selection flow.
 */
import { InlineKeyboard } from 'grammy';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { PROJECT_ROOT } from '../../lib/env.mjs';

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

// Module-level state
const state = loadImportQueueState();
const importQueue = Array.isArray(state.queue) ? state.queue : [];
let importRunning = null;

if (state.runningJob) {
  importQueue.unshift({ ...state.runningJob, requeuedAfterRestart: true, requeuedAt: new Date().toISOString() });
}
saveImportQueueState(importQueue, null);

function runNextImport(notifyAdmins) {
  if (importRunning || importQueue.length === 0) return;

  const job = importQueue.shift();
  const { url, brand, style, category, from, to, ai, publish, minImageSize } = job;

  const scriptPath = join(PROJECT_ROOT, 'scripts', 'import', 'import-yupoo-to-sanity.mjs');
  const spawnArgs = [
    scriptPath, url,
    '--brand', brand,
    '--style', style,
    '--from', String(from),
    '--to', String(to),
  ];
  if (category) spawnArgs.push('--category', category);
  if (minImageSize != null && minImageSize > 0) spawnArgs.push('--min-image-size', String(minImageSize));
  if (job.concurrency) spawnArgs.push('--concurrency', String(job.concurrency));
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
      notifyAdmins(`Импорт завершён.\nURL: ${url}\nБренд: ${brand}, стиль: ${style}\n\n${errTail}`).catch(() => {});
    } else {
      notifyAdmins(`Импорт с ошибкой (код ${code}${signal ? `, ${signal}` : ''}).\nURL: ${url}\n\n${errTail}`).catch(() => {});
    }
    importRunning = null;
    saveImportQueueState(importQueue, null);
    runNextImport(notifyAdmins);
  });

  child.on('error', (err) => {
    notifyAdmins(`Импорт: не удалось запустить — ${err.message}`).catch(() => {});
    importRunning = null;
    saveImportQueueState(importQueue, null);
    runNextImport(notifyAdmins);
  });
}

export function register(bot, { prisma, sanity, webAppUrl, notifyAdmins }) {
  // Start processing queue on boot
  runNextImport(notifyAdmins);

  bot.command('importcategory', async (ctx) => {
    const raw = ctx.message?.text?.replace(/^\/importcategory\s+/i, '').trim() || '';
    if (!raw) {
      await ctx.reply(
        'Импорт категории Yupoo (очередь).\n\n' +
        'Использование:\n' +
        '/importcategory <URL> --brand SLUG --style SLUG [--from N] [--to M] [--min-image-size KB] [--ai] [--publish]\n\n' +
        '/importqueue — показать очередь'
      );
      return;
    }

    const args = raw.split(/\s+/);
    let url = null, brand = null, style = null, category = null;
    let from = 1, to = 20;
    let minImageSize = null, concurrency = 3;
    let ai = false, publish = false;

    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith('http') && args[i].includes('yupoo')) {
        url = args[i];
      } else if (args[i] === '--brand' && args[i + 1]) { brand = args[++i].trim(); }
      else if (args[i] === '--style' && args[i + 1]) { style = args[++i].trim(); }
      else if (args[i] === '--category' && args[i + 1]) { category = args[++i].trim(); }
      else if (args[i] === '--min-image-size' && args[i + 1]) { const n = parseInt(args[++i], 10); minImageSize = Number.isNaN(n) ? null : Math.max(0, n); }
      else if (args[i] === '--concurrency' && args[i + 1]) { concurrency = parseInt(args[++i], 10) || 3; }
      else if (args[i] === '--from' && args[i + 1]) { from = parseInt(args[++i], 10) || 1; }
      else if (args[i] === '--to' && args[i + 1]) { to = parseInt(args[++i], 10) || 20; }
      else if (args[i] === '--ai') { ai = true; }
      else if (args[i] === '--publish') { publish = true; }
    }

    if (!url || !brand || !style) {
      await ctx.reply('Нужны: URL категории Yupoo, --brand SLUG и --style SLUG.');
      return;
    }

    const job = { url, brand, style, category, from, to, minImageSize, concurrency, ai, publish };
    importQueue.push(job);
    saveImportQueueState(importQueue, importRunning?.job || null);

    const minImg = minImageSize != null ? `, мин. фото: ${minImageSize} KB` : '';
    await ctx.reply(
      `Добавлено в очередь. Позиция: ${importQueue.length}.\n` +
      `${brand} / ${style}, ${from}–${to}${minImg}${ai ? ', ИИ' : ''}. Уведомлю по окончании.`
    );

    runNextImport(notifyAdmins);
  });

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
        await ctx.reply(`Использование:\n/importqueue remove <N>\n\nСейчас в очереди: ${importQueue.length}`);
        return;
      }
      const removedJob = importQueue.splice(n - 1, 1)[0];
      saveImportQueueState(importQueue, importRunning?.job || null);
      await ctx.reply(`Удалено из очереди (#${n}):\n${removedJob.brand} / ${removedJob.style} — ${removedJob.url}`);
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

  bot.command('importcancel', async (ctx) => {
    if (!importRunning?.child) {
      await ctx.reply('Сейчас нет активного импорта.');
      return;
    }

    const { job, child } = importRunning;
    job.cancelled = true;
    saveImportQueueState(importQueue, job);

    const pid = child.pid;
    try { child.kill('SIGTERM'); } catch {}
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

  // ── Callback queries for interactive import flow ──────────────

  bot.callbackQuery(/^import:(.+):(.+)$/, async (ctx) => {
    if (!sanity) { await ctx.answerCallbackQuery('Sanity не настроен'); return; }
    const supplierId = ctx.match[1];
    const albumId = ctx.match[2];

    let supplierUrl = null;
    const numId = parseInt(supplierId, 10);
    if (!isNaN(numId)) {
      const s = await prisma.supplier.findUnique({ where: { id: numId } });
      supplierUrl = s?.url || null;
    } else {
      const s = await sanity.fetch(`*[_type == "yupooSupplier" && _id == $id][0]{ url }`, { id: supplierId });
      supplierUrl = s?.url || null;
    }

    const baseUrl = supplierUrl?.replace(/\/$/, '') || '';
    const albumUrl = `${baseUrl.split('/categories')[0].split('/albums')[0]}/albums/${albumId}`;

    ctx.session.importAlbumUrl = albumUrl;
    ctx.session.importSupplierId = supplierId;
    ctx.session.state = 'selectBrand';

    const brands = await sanity.fetch(`*[_type == "brand"] | order(title asc) { _id, title }`);
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
    if (!sanity) { await ctx.answerCallbackQuery(); return; }
    ctx.session.importBrandId = ctx.match[1];
    ctx.session.state = 'selectStyle';

    const styles = await sanity.fetch(`*[_type == "style"] | order(title asc) { _id, title }`);
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
}

/**
 * Text handler for the import subtype input.
 * Must be called from the main bot's text handler.
 */
export async function handleImportText(ctx, { sanity, webAppUrl }) {
  if (ctx.session.state !== 'awaitingSubtype' || !ctx.session.importAlbumUrl) {
    return false;
  }

  const subtype = ctx.message.text.trim();
  if (!subtype) { await ctx.reply('Напишите подтип:'); return true; }

  const { importAlbumUrl, importBrandId, importStyleId } = ctx.session;
  ctx.session.state = null;
  ctx.session.importAlbumUrl = null;

  await ctx.reply(`Импорт запущен...\nАльбом: ${importAlbumUrl}\nПодтип: ${subtype}\n\nЭто может занять 1-2 минуты.`);

  try {
    const { importSingleAlbum } = await import('../../lib/yupoo-scraper.mjs');
    const result = await importSingleAlbum({
      albumUrl: importAlbumUrl,
      brandId: importBrandId,
      styleId: importStyleId,
      subtype,
      sanityClient: sanity,
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

  return true;
}
