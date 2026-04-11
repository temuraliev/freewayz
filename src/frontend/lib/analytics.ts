/**
 * Lightweight PostHog wrapper for both browser and server.
 *
 * Configure NEXT_PUBLIC_POSTHOG_KEY (browser) and POSTHOG_KEY (server, optional).
 * Falls back to no-op if keys are unset.
 */

export type AnalyticsEvent =
  | "view_product"
  | "add_to_cart"
  | "remove_from_cart"
  | "start_checkout"
  | "complete_order"
  | "wishlist_add"
  | "wishlist_remove"
  | "search"
  | "apply_promo"
  | "open_admin"
  | "filter_change";

export interface EventProps {
  productId?: string;
  productTitle?: string;
  brand?: string;
  price?: number;
  total?: number;
  query?: string;
  promoCode?: string;
  [key: string]: unknown;
}

// ── Browser side ──────────────────────────────────────────

let browserClient: typeof import("posthog-js").default | null = null;

export function initBrowserAnalytics() {
  if (typeof window === "undefined") return;
  if (browserClient) return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  import("posthog-js")
    .then((mod) => {
      browserClient = mod.default;
      browserClient.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        capture_pageview: true,
        autocapture: false, // we'll send explicit events
        disable_session_recording: true,
        loaded: () => {
          // Identify user from Telegram WebApp if available
          const tg = (window as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number; username?: string; first_name?: string } } } } }).Telegram;
          const user = tg?.WebApp?.initDataUnsafe?.user;
          if (user?.id) {
            browserClient?.identify(String(user.id), {
              username: user.username,
              first_name: user.first_name,
            });
          }
        },
      });
    })
    .catch(() => {});
}

export function track(event: AnalyticsEvent, props?: EventProps) {
  if (typeof window === "undefined") return;
  if (!browserClient) {
    // Try lazy init in case it wasn't called yet
    initBrowserAnalytics();
    return;
  }
  browserClient.capture(event, props);
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (typeof window === "undefined" || !browserClient) return;
  browserClient.identify(userId, traits);
}
