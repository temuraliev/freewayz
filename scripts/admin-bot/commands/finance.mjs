/**
 * Finance commands: /expense
 */
export function register(bot, { prisma }) {
  bot.command('expense', async (ctx) => {
    const rest = ctx.message?.text?.replace(/^\/expense\s+/i, '').trim() || '';
    const parts = rest.split(/\s+/);
    const amount = parts[0] ? parseInt(parts[0], 10) : NaN;
    const description = parts.slice(1).join(' ') || 'Расход';
    if (Number.isNaN(amount) || amount <= 0) {
      await ctx.reply('Использование: /expense <сумма> <описание>');
      return;
    }
    try {
      await prisma.expense.create({
        data: {
          date: new Date(),
          amount,
          currency: 'UZS',
          category: 'other',
          description,
        },
      });
      await ctx.reply(`Расход записан: ${amount.toLocaleString()} UZS — ${description}`);
    } catch (e) {
      await ctx.reply('Ошибка: ' + (e.message || 'create failed'));
    }
  });
}
