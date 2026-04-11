"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { admin as adminApi } from "@/lib/api-client";

function getInitData(): string {
  if (typeof window === "undefined") return "";
  return window.Telegram?.WebApp?.initData ?? "";
}

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

interface OrdersResponse {
  orders: Order[];
  counts: Counts;
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
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");

  const params = new URLSearchParams();
  if (activeTab !== "all") params.set("status", activeTab);
  if (committedSearch) params.set("q", committedSearch);
  const key = `/api/admin/orders?${params.toString()}`;

  const { data, isLoading } = useSWR<OrdersResponse>(key, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });

  const orders = data?.orders ?? [];
  const counts = data?.counts ?? null;

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Заказы</h2>
        <div className="flex items-center gap-3">
          <a
            href={`/api/admin/orders/export${activeTab !== "all" ? `?status=${activeTab}` : ""}`}
            className="text-sm text-muted-foreground underline hover:text-foreground"
            download
          >
            Экспорт CSV
          </a>
          <Link href="/admin" className="text-sm text-muted-foreground underline">
            Дашборд
          </Link>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setCommittedSearch(search)}
          placeholder="Поиск по ID или @username..."
          className="flex-1 border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          onClick={() => setCommittedSearch(search)}
          className="bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Найти
        </button>
      </div>

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
              {count != null && count > 0 && <span className="ml-1 opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      {isLoading && !data ? (
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
                <div className="flex items-center gap-2">
                  {o.status === "new" && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        adminApi.patchOrder(String(o.id), { initData: getInitData(), status: "ordered" })
                          .then(() => mutate(key));
                      }}
                      className="bg-green-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-green-700"
                    >
                      Подтвердить
                    </button>
                  )}
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      STATUS_COLORS[o.status] || "bg-muted text-muted-foreground"
                    }`}
                  >
                    {o.status}
                  </span>
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {o.user?.username ? `@${o.user.username}` : o.user?.firstName || "—"}
                </span>
                <span className="font-mono">{(o.total || 0).toLocaleString()} UZS</span>
              </div>
              {(o.trackNumber || o.trackingStatus) && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {o.trackNumber && <span>Трек: {o.trackNumber}</span>}
                  {o.trackingStatus && <span className="ml-2">({o.trackingStatus})</span>}
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
