"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Order {
  _id: string;
  orderId: string;
  total: number;
  status: string;
  trackNumber?: string;
  createdAt?: string;
  user?: { telegramId?: string; username?: string };
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initData =
      typeof window !== "undefined" && window.Telegram?.WebApp?.initData
        ? window.Telegram.WebApp.initData
        : "";
    if (!initData) {
      setLoading(false);
      return;
    }
    fetch("/api/admin/orders", {
      method: "GET",
      headers: { "X-Telegram-Init-Data": initData },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-semibold">Заказы</h2>
      {orders.length === 0 ? (
        <p className="text-muted-foreground">Нет заказов</p>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Link
              key={o._id}
              href={`/admin/orders/${o._id}`}
              className="block border border-border bg-card p-4 transition hover:bg-muted/50"
            >
              <div className="flex justify-between">
                <span className="font-mono font-medium">#{o.orderId}</span>
                <span className="text-muted-foreground">{o.status}</span>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {o.total?.toLocaleString()} UZS
                {o.trackNumber && ` · ${o.trackNumber}`}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
