"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Order {
  id: number;
  orderId: string;
  total: number;
  status: string;
  trackNumber?: string;
  trackingStatus?: string;
  createdAt?: string;
  user?: { telegramId?: string; username?: string; firstName?: string };
}

interface Counts {
  all: number;
  new: number;
  paid: number;
  ordered: number;
  shipped: number;
  delivered: number;
  cancelled: number;
}

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "new", label: "Новые" },
  { key: "paid", label: "Оплачен" },
  { key: "ordered", label: "Заказан" },
  { key: "shipped", label: "Отправлен" },
  { key: "delivered", label: "Доставлен" },
  { key: "cancelled", label: "Отменён" },
];

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400",
  paid: "bg-yellow-500/20 text-yellow-400",
  ordered: "bg-orange-500/20 text-orange-400",
  shipped: "bg-purple-500/20 text-purple-400",
  delivered: "bg-green-500/20 text-green-400",
  cancelled: "bg-red-500/20 text-red-400",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");

  const initData =
    typeof window !== "undefined" && window.Telegram?.WebApp?.initData
      ? window.Telegram.WebApp.initData
      : "";

  const fetchOrders = useCallback(
    async (status: string, q: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (status && status !== "all") params.set("status", status);
        if (q) params.set("q", q);
        const res = await fetch(
          `/api/admin/orders?${params.toString()}`,
          {
            headers: { "X-Telegram-Init-Data": initData },
          }
        );
        if (res.ok) {
          const data = await res.json();
          setOrders(Array.isArray(data.orders) ? data.orders : Array.isArray(data) ? data : []);
          if (data.counts) setCounts(data.counts);
        }
      } catch {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    },
    [initData]
  );

  useEffect(() => {
    fetchOrders(activeTab, search);
  }, [initData, activeTab, fetchOrders]);

  const handleSearch = () => {
    fetchOrders(activeTab, search);
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Заказы</h2>
        <Link
          href="/admin"
          className="text-sm text-muted-foreground underline"
        >
          Дашборд
        </Link>
      </div>

      {/* Search */}
      <div className="mb-4 flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Поиск по ID или @username..."
          className="flex-1 border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          onClick={handleSearch}
          className="bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Найти
        </button>
      </div>

      {/* Status tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const count = counts ? counts[tab.key as keyof Counts] : null;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap px-3 py-1.5 text-xs font-medium transition ${
                activeTab === tab.key
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab.label}
              {count != null && count > 0 && (
                <span className="ml-1 opacity-70">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="flex min-h-[20vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
        </div>
      ) : orders.length === 0 ? (
        <p className="text-muted-foreground">Нет заказов</p>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/admin/orders/${o.id}`}
              className="block border border-border bg-card p-4 transition hover:bg-muted/50"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-medium">#{o.orderId}</span>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[o.status] || "bg-muted text-muted-foreground"}`}
                >
                  {o.status}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {o.user?.username ? `@${o.user.username}` : o.user?.firstName || "—"}
                </span>
                <span className="font-mono">
                  {(o.total || 0).toLocaleString()} UZS
                </span>
              </div>
              {(o.trackNumber || o.trackingStatus) && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {o.trackNumber && <span>Трек: {o.trackNumber}</span>}
                  {o.trackingStatus && (
                    <span className="ml-2">({o.trackingStatus})</span>
                  )}
                </div>
              )}
              {o.createdAt && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(o.createdAt).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
