/**
 * Order commands: /orders, /order, /neworder, /track, /confirm
 */
import { InlineKeyboard } from 'grammy';
import { registerWith17track } from '../../lib/track17.mjs';

export function register(bot, { prisma, webAppUrl, notifyAdmins }) {
  bot.command('orders', async (ctx) => {
    try {
      const orders = await prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: { id: true, orderId: true, total: true, status: true, trackNumber: true },
      });
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

  bot.command('order', async (ctx) => {
    const arg = ctx.message?.text?.replace(/^\/order\s+/i, '').trim() || '';
    if (!arg) { await ctx.reply('Использование: /order <orderId>'); return; }
    try {
      const numericId = parseInt(arg, 10);
      const order = await prisma.order.findFirst({
        where: isNaN(numericId) ? { orderId: arg } : { OR: [{ id: numericId }, { orderId: arg }] },
        include: { user: { select: { telegramId: true, username: true } } },
      });
      if (!order) { await ctx.reply('Заказ не найден.'); return; }

      const items = Array.isArray(order.items) ? order.items : [];
      let text = `#${order.orderId}\n` +
        `Статус: ${order.status}\n` +
        `Сумма: ${(order.total || 0).toLocaleString()} UZS\n`;
      if (order.user?.username) text += `Клиент: @${order.user.username}\n`;
      if (order.trackNumber) text += `Трек: ${order.trackNumber}\n`;
      if (order.trackingStatus) text += `17track: ${order.trackingStatus}\n`;
      if (order.trackUrl) text += `Ссылка: ${order.trackUrl}\n`;
      if (order.notes) text += `Заметки: ${order.notes}\n`;
      if (items.length) {
        text += '\nТовары:\n';
        items.forEach((it, i) => {
          text += `  ${i + 1}. ${it.brand || ''} ${it.title} — ${it.size || ''} — ${(it.price || 0).toLocaleString()} UZS x${it.quantity || 1}\n`;
        });
      }
      const kb = new InlineKeyboard();
      if (webAppUrl) kb.webApp('Открыть в панели', `${webAppUrl}/admin/orders/${order.id}`);
      await ctx.reply(text.trim(), kb.inline_keyboard?.length ? { reply_markup: kb } : {});
    } catch (e) {
      await ctx.reply('Ошибка: ' + (e.message || 'fetch failed'));
    }
  });

  bot.command('neworder', async (ctx) => {
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
      const userDoc = await prisma.user.upsert({
        where: { telegramId: `manual-${usernameRaw}` },
        update: {},
        create: {
          telegramId: `manual-${usernameRaw}`,
          username: usernameRaw,
          firstName: usernameRaw,
        },
      });

      const orderId = `M${Date.now().toString(36).toUpperCase()}`;
      const items = itemNames.map((name) => ({
        productId: '',
        title: name,
        brand: '',
        size: 'One Size',
        color: '',
        price: Math.round(total / itemNames.length),
        quantity: 1,
      }));

      await prisma.order.create({
        data: { orderId, userId: userDoc.id, items, total, status: 'new' },
      });

      await ctx.reply(`Заказ #${orderId} создан для @${usernameRaw} на ${total.toLocaleString()} UZS`);
    } catch (e) {
      await ctx.reply('Ошибка: ' + (e.message || 'create failed'));
    }
  });

  bot.command('track', async (ctx) => {
    const rest = ctx.message?.text?.replace(/^\/track\s+/i, '').trim() || '';
    const parts = rest.split(/\s+/);
    if (parts.length < 2) {
      await ctx.reply('Использование: /track <orderId> <трек-номер>');
      return;
    }
    const [orderIdArg, trackNum] = parts;
    try {
      const numericId = parseInt(orderIdArg, 10);
      const order = await prisma.order.findFirst({
        where: isNaN(numericId) ? { orderId: orderIdArg } : { OR: [{ id: numericId }, { orderId: orderIdArg }] },
      });
      if (!order) { await ctx.reply('Заказ не найден.'); return; }

      const trackUrl = `https://t.17track.net/en#nums=${encodeURIComponent(trackNum)}`;
      await prisma.order.update({
        where: { id: order.id },
        data: { trackNumber: trackNum, trackUrl },
      });

      let statusMsg = `Трек ${trackNum} привязан к заказу #${order.orderId}`;

      const reg = await registerWith17track(trackNum);
      if (reg?.success) {
        await prisma.order.update({ where: { id: order.id }, data: { track17Registered: true } });
        statusMsg += '\n17track: зарегистрирован для отслеживания';
      }

      if (order.status === 'ordered' || order.status === 'paid') {
        await prisma.order.update({ where: { id: order.id }, data: { status: 'shipped' } });
        statusMsg += '\nСтатус обновлён на: shipped';
      }

      await ctx.reply(statusMsg);
    } catch (e) {
      await ctx.reply('Ошибка: ' + (e.message || 'update failed'));
    }
  });

  bot.command('confirm', async (ctx) => {
    const arg = ctx.message?.text?.replace(/^\/confirm\s+/i, '').trim() || '';
    if (!arg) { await ctx.reply('Использование: /confirm <orderId>'); return; }
    try {
      const numericId = parseInt(arg, 10);
      const order = await prisma.order.findFirst({
        where: isNaN(numericId) ? { orderId: arg } : { OR: [{ id: numericId }, { orderId: arg }] },
        include: { user: true },
      });
      if (!order) { await ctx.reply('Заказ не найден.'); return; }
      if (order.status !== 'new' && order.status !== 'paid') {
        await ctx.reply(`Заказ #${order.orderId} уже в статусе: ${order.status}`);
        return;
      }

      const orderTotal = order.total || 0;
      const user = order.user;
      let replyText = `Заказ #${order.orderId} подтверждён (ordered)`;

      if (user) {
        const newTotalSpent = (user.totalSpent || 0) + orderTotal;

        let newStatus = 'ROOKIE';
        if (newTotalSpent >= 7000000) newStatus = 'LEGEND';
        else if (newTotalSpent >= 4000000) newStatus = 'PRO';

        let userCashbackIncrement = 0;

        if (user.referredBy && (!user.totalSpent || user.totalSpent === 0)) {
          const REFERRER_BONUS = 50000;
          const referrer = await prisma.user.findUnique({ where: { telegramId: user.referredBy } });

          if (referrer) {
            await prisma.user.update({
              where: { id: referrer.id },
              data: { cashbackBalance: { increment: REFERRER_BONUS } },
            });

            bot.api.sendMessage(referrer.telegramId,
              `💰 <b>Бонус начислен!</b>\n\nТвой друг ${user.firstName || ''} @${user.username || ''} сделал первый заказ. Тебе начислено <b>50,000 UZS</b> кэшбэка!`,
              { parse_mode: 'HTML' }
            ).catch(() => {});

            userCashbackIncrement = REFERRER_BONUS;
            replyText += ' + Начислен реферальный бонус 50,000 UZS';
          }
        }

        await prisma.$transaction([
          prisma.user.update({
            where: { id: user.id },
            data: {
              totalSpent: newTotalSpent,
              status: newStatus,
              ...(userCashbackIncrement > 0 ? { cashbackBalance: { increment: userCashbackIncrement } } : {}),
            },
          }),
          prisma.order.update({
            where: { id: order.id },
            data: { status: 'ordered' },
          }),
        ]);

        if (newStatus !== user.status) {
          replyText += `\n⬆️ Статус клиента повышен до <b>${newStatus}</b>!`;
        }
      } else {
        await prisma.order.update({ where: { id: order.id }, data: { status: 'ordered' } });
      }

      await ctx.reply(replyText, { parse_mode: 'HTML' });
    } catch (e) {
      await ctx.reply('Ошибка: ' + (e.message || 'update failed'));
    }
  });
}
