import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@backend/data-source";
import { Supplier } from "@backend/entities/Supplier";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
};

const MAX_NEW_ALBUMS_PER_SUPPLIER = 10;
const MAX_PREVIEW_IMAGES = 5;

function resolveUrl(href: string, base: string): string {
  if (!href) return "";
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return "https:" + href;
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

function extractAlbumId(url: string): string | null {
  const m = url.match(/\/albums\/(\d+)/);
  return m ? m[1] : null;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS, redirect: "follow" });
  return res.text();
}

function parseCategoryAlbums(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const origin = baseUrl.startsWith("http") ? new URL(baseUrl).origin : "";

  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]);
      const albums = data?.props?.pageProps?.albums ?? data?.props?.pageProps?.albumList ?? data?.props?.pageProps?.list ?? [];
      const items = Array.isArray(albums) ? albums : (albums?.items ?? []);
      for (const item of items) {
        const id = item.id ?? item.album_id ?? item._id;
        const link = item.link ?? item.url;
        if (id) {
          const href = link && link.startsWith("http") ? link : `${origin}/albums/${id}`;
          if (!links.includes(href)) links.push(href);
        }
      }
    } catch {}
  }

  if (links.length === 0) {
    const albumRegex = /href="([^"]*\/albums\/\d+[^"]*)"/g;
    let match;
    while ((match = albumRegex.exec(html)) !== null) {
      const full = resolveUrl(match[1], baseUrl);
      if (!links.includes(full)) links.push(full);
    }
  }

  return [...new Set(links)];
}

function parseAlbumImages(html: string, albumUrl: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  const imgRegex = /data-origin-src="([^"]+)"|data-original="([^"]+)"|src="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    const raw = m[1] || m[2] || m[3];
    if (!raw || raw.startsWith("data:") || raw.includes("avatar") || raw.includes("logo")) continue;
    const full = raw.startsWith("//") ? "https:" + raw : resolveUrl(raw, albumUrl);
    try {
      const norm = new URL(full);
      norm.search = "";
      if (!seen.has(norm.href)) { seen.add(norm.href); urls.push(full); }
    } catch {}
  }
  return urls;
}

function parseAlbumTitle(html: string): string {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) return h1Match[1].trim();
  return "Product";
}

async function fetchAlbumList(supplierUrl: string, maxPages = 20): Promise<string[]> {
  const baseUrl = supplierUrl.replace(/\?.*$/, "");
  const isRoot = baseUrl.endsWith(".com") || baseUrl.endsWith(".com/") || baseUrl.endsWith("/albums") || baseUrl.endsWith("/albums/");
  const catUrl = isRoot ? baseUrl.replace(/\/?$/, "/albums/") : baseUrl;
  const seen = new Set<string>();
  const all: string[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const pageUrl = page === 1 ? catUrl : catUrl + (catUrl.includes("?") ? "&" : "?") + "page=" + page;
    try {
      const html = await fetchHtml(pageUrl);
      const albums = parseCategoryAlbums(html, pageUrl);
      if (albums.length === 0) break;
      let added = 0;
      for (const u of albums) { if (!seen.has(u)) { seen.add(u); all.push(u); added++; } }
      if (added === 0) break;
    } catch { break; }
    await new Promise((r) => setTimeout(r, 300));
  }
  return all;
}

async function sendTelegramMediaGroup(botToken: string, chatId: string, imageUrls: string[], caption: string) {
  const media = imageUrls.map((url, i) => ({ type: "photo" as const, media: url, ...(i === 0 ? { caption } : {}) }));
  await fetch(`https://api.telegram.org/bot${botToken}/sendMediaGroup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, media }),
  });
}

async function sendTelegramMessage(botToken: string, chatId: string, text: string, replyMarkup?: object) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }),
  });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ds = await getDataSource();
  const supplierRepo = ds.getRepository(Supplier);

  const botToken = (process.env.ADMIN_BOT_TOKEN || process.env.BOT_TOKEN || "").replace(/\r\n?|\n/g, "").trim();
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);

  if (!botToken || adminIds.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no bot token or admin ids" });
  }

  const suppliers = await supplierRepo.find({ where: { isActive: true } });
  if (!suppliers.length) {
    return NextResponse.json({ ok: true, checked: 0 });
  }

  let totalNew = 0;

  for (const supplier of suppliers) {
    try {
      const albumUrls = await fetchAlbumList(supplier.url);
      const knownIds = new Set<string>(supplier.knownAlbumIds || []);
      const newAlbums = albumUrls.filter((url) => {
        const id = extractAlbumId(url);
        return id && !knownIds.has(id);
      });

      const toNotify = newAlbums.slice(0, MAX_NEW_ALBUMS_PER_SUPPLIER);
      totalNew += toNotify.length;

      for (const albumUrl of toNotify) {
        const albumId = extractAlbumId(albumUrl) || "";
        let imageUrls: string[] = [];
        let albumTitle = "New item";
        try {
          const html = await fetchHtml(albumUrl);
          albumTitle = parseAlbumTitle(html);
          imageUrls = parseAlbumImages(html, albumUrl).slice(0, MAX_PREVIEW_IMAGES);
        } catch {}

        for (const adminChatId of adminIds) {
          try {
            if (imageUrls.length > 0) {
              await sendTelegramMediaGroup(botToken, adminChatId, imageUrls, `${supplier.name}\n${albumTitle}`);
            }
            await sendTelegramMessage(botToken, adminChatId, `${supplier.name}: ${albumTitle}\n${albumUrl}`, {
              inline_keyboard: [[
                { text: "Импортировать", callback_data: `import:${supplier.id}:${albumId}` },
                { text: "Закрыть", callback_data: `close:${albumId}` },
              ]],
            });
          } catch (e) {
            console.error(`Telegram notify error for ${adminChatId}:`, (e as Error).message);
          }
        }
        await new Promise((r) => setTimeout(r, 500));
      }

      const allIds = albumUrls.map((u) => extractAlbumId(u)).filter(Boolean) as string[];
      await supplierRepo.update(supplier.id, {
        lastCheckedAt: new Date(),
        lastAlbumCount: albumUrls.length,
        knownAlbumIds: allIds,
      });
    } catch (e) {
      console.error(`Supplier check error (${supplier.name}):`, (e as Error).message);
    }
  }

  return NextResponse.json({ ok: true, checked: suppliers.length, newAlbums: totalNew });
}
