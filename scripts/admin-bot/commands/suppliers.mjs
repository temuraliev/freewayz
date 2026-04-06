/**
 * Supplier commands: /suppliers, /addsupplier
 */
export function register(bot, { prisma, webAppUrl }) {
  bot.command('suppliers', async (ctx) => {
    try {
      const list = await prisma.supplier.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { name: true, url: true, lastAlbumCount: true },
      });
      if (!list?.length) { await ctx.reply('Нет поставщиков. Добавьте: /addsupplier <url>'); return; }
      const lines = list.map((s) => `${s.name}: ${s.lastAlbumCount ?? '?'} альбомов`);
      const keyboard = webAppUrl
        ? { reply_markup: { inline_keyboard: [[{ text: 'Открыть в панели', web_app: { url: `${webAppUrl}/admin/suppliers` } }]] } }
        : {};
      await ctx.reply(lines.join('\n'), keyboard);
    } catch (e) {
      await ctx.reply('Ошибка: ' + (e.message || 'fetch failed'));
    }
  });

  bot.command('addsupplier', async (ctx) => {
    const url = ctx.message?.text?.replace(/^\/addsupplier\s+/i, '').trim() || '';
    if (!url || !url.startsWith('http')) {
      await ctx.reply('Использование: /addsupplier <url>');
      return;
    }
    try {
      const name = url.replace(/^https?:\/\//, '').split('/')[0] || 'Supplier';
      await prisma.supplier.create({
        data: { name, url, isActive: true, knownAlbumIds: [] },
      });
      await ctx.reply(`Поставщик добавлен: ${name}`);
    } catch (e) {
      await ctx.reply('Ошибка: ' + (e.message || 'create failed'));
    }
  });
}
