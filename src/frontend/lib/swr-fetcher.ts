/**
 * Generic fetcher for SWR that sends Telegram initData header.
 * Throws on non-2xx so SWR shows errors.
 */
function getInitData(): string {
  if (typeof window === "undefined") return "";
  return window.Telegram?.WebApp?.initData ?? "";
}

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "X-Telegram-Init-Data": getInitData() },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}
