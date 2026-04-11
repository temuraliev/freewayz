/**
 * HTTP client for communicating with the FreeWayz API backend.
 *
 * All client-side components should use these functions instead of
 * calling fetch('/api/...') directly. The base URL is controlled by
 * the NEXT_PUBLIC_API_URL environment variable (defaults to '' for
 * same-origin during migration, set to e.g. 'http://localhost:4000'
 * for local dev with separate backend).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

type RequestOptions = {
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

// ── Core helpers ──────────────────────────────────────────

async function request<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiClientError(body?.error || res.statusText, res.status, body);
  }

  // Handle empty body (204 No Content)
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

function withInitData(headers?: Record<string, string>): Record<string, string> {
  const initData = typeof window !== "undefined"
    ? (window as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp?.initData || ""
    : "";
  return { ...headers, ...(initData ? { "X-Telegram-Init-Data": initData } : {}) };
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

// ── Auth ──────────────────────────────────────────────────

export function authTelegram(initData: string) {
  return request<{ ok: boolean; user: { id: number; first_name: string; username?: string }; authDate: number }>(
    "/api/auth/telegram",
    { method: "POST", body: JSON.stringify({ initData }) }
  );
}

// ── User ──────────────────────────────────────────────────

export function getMe(opts?: RequestOptions) {
  return request<Record<string, unknown>>("/api/user/me", {
    headers: withInitData(opts?.headers),
    signal: opts?.signal,
  });
}

export function savePreferences(initData: string, brandIds: string[], styleIds: string[]) {
  return request<{ ok: boolean }>("/api/user/preferences", {
    method: "POST",
    body: JSON.stringify({ initData, brandIds, styleIds }),
  });
}

export function syncCart(initData: string, cartItems: unknown[]) {
  return request<{ success: boolean }>("/api/user/sync-cart", {
    method: "POST",
    body: JSON.stringify({ initData, cartItems }),
  });
}

export function linkReferral(initData: string, referrerId: string | number) {
  return request<{ success: boolean }>("/api/user/link-referral", {
    method: "POST",
    body: JSON.stringify({ initData, referrerId }),
  });
}

// ── Wishlist ──────────────────────────────────────────────

export function getWishlist(opts?: RequestOptions) {
  return request<{ items: unknown[] }>("/api/user/wishlist", {
    headers: withInitData(opts?.headers),
  });
}

export function addToWishlist(body: {
  initData: string;
  productId: string;
  title?: string;
  brand?: string;
  price?: number;
  imageUrl?: string;
}) {
  return request<{ ok: boolean }>("/api/user/wishlist", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function removeFromWishlist(productId: string, opts?: RequestOptions) {
  return request<{ ok: boolean }>(
    `/api/user/wishlist?productId=${encodeURIComponent(productId)}`,
    { method: "DELETE", headers: withInitData(opts?.headers) }
  );
}

// ── Recently Viewed ───────────────────────────────────────

export function getRecentlyViewed(opts?: RequestOptions) {
  return request<{ products: unknown[] }>("/api/user/recently-viewed", {
    headers: withInitData(opts?.headers),
  });
}

// ── Products ──────────────────────────────────────────────

export function trackProductView(body: {
  initData: string;
  productId: string;
  brandSlug?: string;
  styleSlug?: string;
}) {
  return request<{ ok: boolean; tracked: boolean }>("/api/products/view", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Checkout ──────────────────────────────────────────────

export function checkout(body: {
  username: string;
  items: unknown[];
  total: number;
}) {
  return request<{ ok: boolean; checkoutUrl: string; verifiedTotal: number; priceAdjusted: boolean }>(
    "/api/checkout",
    { method: "POST", body: JSON.stringify(body) }
  );
}

// ── Orders ────────────────────────────────────────────────

export function createOrder(body: {
  initData: string;
  items: unknown[];
  total: number;
  promoCode?: string;
  discount?: number;
  idempotencyKey?: string;
}) {
  return request<{ ok: boolean; orderId: string }>("/api/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getOrderHistory(opts?: RequestOptions) {
  return request<{ orders: unknown[] }>("/api/orders/history", {
    headers: withInitData(opts?.headers),
  });
}

// ── Promo ─────────────────────────────────────────────────

export function applyPromo(initData: string, code: string, context?: "cart" | "profile") {
  return request<{ ok: boolean; type: string; value: number; code?: string; minOrderTotal?: number; newBalance?: number }>(
    "/api/promo/apply",
    { method: "POST", body: JSON.stringify({ initData, code, context }) }
  );
}

// ── Recommendations & Cross-Sell ──────────────────────────

export function getRecommendations(
  telegramId?: string,
  opts?: RequestOptions
) {
  const params = telegramId ? `?telegramId=${telegramId}` : "";
  return request<{ products: unknown[]; tier: number }>(`/api/recommendations${params}`, {
    headers: withInitData(opts?.headers),
  });
}

export function getCrossSell(params: URLSearchParams) {
  return request<{ products: unknown[] }>(`/api/cross-sell?${params.toString()}`);
}

// ── Admin ─────────────────────────────────────────────────

export const admin = {
  checkAuth(initData: string) {
    return request<{ ok: boolean; user: { id: number; first_name: string } }>(
      "/api/admin/auth",
      { method: "POST", body: JSON.stringify({ initData }) }
    );
  },

  login(password: string) {
    return request<{ ok: boolean }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },

  logout() {
    return request<{ ok: boolean }>("/api/admin/logout", { method: "POST" });
  },

  getDashboard(opts?: RequestOptions) {
    return request<{ alerts: unknown[]; stats: Record<string, number> }>("/api/admin/finance/dashboard", {
      headers: withInitData(opts?.headers),
    });
  },

  // Customers
  getCustomers(q?: string, opts?: RequestOptions) {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    return request<unknown[]>(`/api/admin/customers${params}`, {
      headers: withInitData(opts?.headers),
    });
  },

  patchCustomer(id: number, body: { initData: string; adminNotes?: string; phone?: string; address?: string }) {
    return request<{ ok: boolean }>(`/api/admin/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  // Orders
  getOrders(params?: { status?: string; q?: string }, opts?: RequestOptions) {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.q) sp.set("q", params.q);
    const qs = sp.toString() ? `?${sp.toString()}` : "";
    return request<{ orders: unknown[]; counts: Record<string, number> }>(`/api/admin/orders${qs}`, {
      headers: withInitData(opts?.headers),
    });
  },

  getOrder(id: string, opts?: RequestOptions) {
    return request<Record<string, unknown>>(`/api/admin/orders/${encodeURIComponent(id)}`, {
      headers: withInitData(opts?.headers),
    });
  },

  patchOrder(id: string, body: Record<string, unknown>) {
    return request<{ ok: boolean }>(`/api/admin/orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  exportOrders(params?: { status?: string; from?: string; to?: string }, opts?: RequestOptions) {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const url = `${API_BASE}/api/admin/orders/export?${sp.toString()}`;
    return fetch(url, { headers: withInitData(opts?.headers) });
  },

  // Finance
  getFinance(params?: { from?: string; to?: string }, opts?: RequestOptions) {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString() ? `?${sp.toString()}` : "";
    return request<{ expenses: unknown[]; revenue: number; costOfGoods: number; totalExpense: number; profit: number }>(
      `/api/admin/finance${qs}`,
      { headers: withInitData(opts?.headers) }
    );
  },

  createExpense(body: { initData: string; date: string; amount: number; currency: string; category: string; description?: string }) {
    return request<{ ok: boolean }>("/api/admin/finance", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  getDailyFinance(days?: number, opts?: RequestOptions) {
    const params = days ? `?days=${days}` : "";
    return request<{ days: number; data: unknown[] }>(`/api/admin/finance/daily${params}`, {
      headers: withInitData(opts?.headers),
    });
  },

  // Promo
  getPromoCodes(opts?: RequestOptions) {
    return request<unknown[]>("/api/admin/promo", {
      headers: withInitData(opts?.headers),
    });
  },

  createPromoCode(body: Record<string, unknown>) {
    return request<{ ok: boolean; id: number; code: string }>("/api/admin/promo", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  patchPromoCode(id: number, body: Record<string, unknown>) {
    return request<{ ok: boolean }>(`/api/admin/promo/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  deletePromoCode(id: number, opts?: RequestOptions) {
    return request<{ ok: boolean }>(`/api/admin/promo/${id}`, {
      method: "DELETE",
      headers: withInitData(opts?.headers),
    });
  },

  // Suppliers
  getSuppliers(opts?: RequestOptions) {
    return request<unknown[]>("/api/admin/suppliers", {
      headers: withInitData(opts?.headers),
    });
  },

  createSupplier(body: { initData?: string; name: string; url: string }) {
    return request<{ ok: boolean; id: string }>("/api/admin/suppliers", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  // Products
  getProduct(id: string, opts?: RequestOptions) {
    return request<Record<string, unknown>>(`/api/admin/products/${encodeURIComponent(id)}`, {
      headers: withInitData(opts?.headers),
    });
  },

  patchProduct(id: string, body: Record<string, unknown>) {
    return request<{ ok: boolean }>(`/api/admin/products/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  publishProduct(id: string, body: { initData?: string }) {
    return request<{ ok: boolean }>(`/api/admin/products/${encodeURIComponent(id)}/publish`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  uploadProductImage(id: string, formData: FormData) {
    const url = `${API_BASE}/api/admin/products/${encodeURIComponent(id)}/upload-image`;
    return fetch(url, { method: "POST", body: formData }).then(async (res) => {
      if (!res.ok) throw new ApiClientError(res.statusText, res.status);
      return res.json() as Promise<{ ok: boolean; assetId: string; url: string }>;
    });
  },
};
