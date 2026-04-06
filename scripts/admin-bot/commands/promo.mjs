/**
 * Promo code commands: /promo create, /promo list, /promo disable
 */
export function register(bot, { prisma }) {
  bot.command('promo', async (ctx) => {
    const rest = ctx.message?.text?.replace(/^\/promo\s+/i, '').trim() || '';
    const parts = rest.split(/\s+/);
    const subCmd = parts[0]?.toLowerCase();

    if (subCmd === 'create') {
      await handleCreate(ctx, parts, prisma);
      return;
    }

    if (subCmd === 'list') {
      await handleList(ctx, prisma);
      return;
    }

    if (subCmd === 'disable') {
      await handleDisable(ctx, parts, prisma);
      return;
    }

    await ctx.reply(
      'Команды промокодов:\n' +
      '/promo create CODE TYPE VALUE — создать\n' +
      '/promo list — список активных\n' +
      '/promo disable CODE — деактивировать'
    );
  });
}

function formatPromoType(type, value) {
  if (type === 'discount_percent') return `${value}%`;
  if (type === 'discount_fixed') return `${value.toLocaleString()} UZS`;
  return `+${value.toLocaleString()} UZS (баланс)`;
}

async function handleCreate(ctx, parts, prisma) {
  const code = parts[1]?.toUpperCase();
  const type = parts[2];
  const value = parseInt(parts[3], 10);
  const maxUses = parts[4] ? parseInt(parts[4], 10) : undefined;
  const maxUsesPerUser = parts[5] ? parseInt(parts[5], 10) : 1;

  const validTypes = ['discount_percent', 'discount_fixed', 'balance_topup'];
  if (!code || !validTypes.includes(type) || isNaN(value) || value <= 0) {
    await ctx.reply(
      'Использование:\n/promo create CODE TYPE VALUE [maxUses] [maxUsesPerUser]\n\n' +
      'TYPE: discount_percent, discount_fixed, balance_topup\n' +
      'Пример: /promo create SUMMER10 discount_percent 10'
    );
    return;
  }

  try {
    const existing = await prisma.promoCode.findUnique({ where: { code } });
    if (existing) {
      await ctx.reply(`Промокод ${code} уже существует.`);
      return;
    }

    await prisma.promoCode.create({
      data: {
        code,
        type,
        value,
        isActive: true,
        usedCount: 0,
        maxUsesPerUser,
        ...(maxUses ? { maxUses } : {}),
      },
    });

    await ctx.reply(
      `Промокод создан:\nКод: ${code}\nТип: ${formatPromoType(type, value)}\n` +
      (maxUses ? `Макс. использований: ${maxUses}\n` : 'Без лимита\n') +
      `На пользователя: ${maxUsesPerUser}`
    );
  } catch (e) {
    await ctx.reply('Ошибка: ' + (e.message || 'create failed'));
  }
}

async function handleList(ctx, prisma) {
  try {
    const codes = await prisma.promoCode.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
      select: { code: true, type: true, value: true, usedCount: true, maxUses: true },
    });
    if (!codes?.length) {
      await ctx.reply('Нет активных промокодов.');
      return;
    }
    const lines = codes.map((c) => {
      const usage = c.maxUses ? `${c.usedCount || 0}/${c.maxUses}` : `${c.usedCount || 0}/∞`;
      return `${c.code} — ${formatPromoType(c.type, c.value)} (${usage})`;
    });
    await ctx.reply('Активные промокоды:\n\n' + lines.join('\n'));
  } catch (e) {
    await ctx.reply('Ошибка: ' + (e.message || 'fetch failed'));
  }
}

async function handleDisable(ctx, parts, prisma) {
  const code = parts[1]?.toUpperCase();
  if (!code) {
    await ctx.reply('Использование: /promo disable CODE');
    return;
  }
  try {
    const promo = await prisma.promoCode.findUnique({ where: { code } });
    if (!promo) {
      await ctx.reply(`Промокод ${code} не найден.`);
      return;
    }
    await prisma.promoCode.update({ where: { id: promo.id }, data: { isActive: false } });
    await ctx.reply(`Промокод ${promo.code} деактивирован.`);
  } catch (e) {
    await ctx.reply('Ошибка: ' + (e.message || 'patch failed'));
  }
}
