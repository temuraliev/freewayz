"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DashStats {
  totalOrders: number;
  newOrders: number;
  activeTracking: number;
  totalRevenue: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashStats | null>(null);

  const initData =
    typeof window !== "undefined" && window.Telegram?.WebApp?.initData
      ? window.Telegram.WebApp.initData
      : "";

  useEffect(() => {
    fetch("/api/admin/orders", {
      headers: { "X-Telegram-Init-Data": initData },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.counts) return;
        setStats({
          totalOrders: data.counts.all || 0,
          newOrders: data.counts.new || 0,
          activeTracking: data.counts.shipped || 0,
          totalRevenue: Array.isArray(data.orders)
            ? data.orders.reduce(
                (s: number, o: { total?: number }) => s + (o.total || 0),
                0
              )
            : 0,
        });
      })
      .catch(() => {});
  }, [initData]);

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-semibold">Дашборд</h2>

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Всего заказов</div>
            <div className="mt-1 font-mono text-2xl font-bold">
              {stats.totalOrders}
            </div>
          </div>
          <div className="border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">
              Ожидают подтверждения
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-blue-400">
              {stats.newOrders}
            </div>
          </div>
          <div className="border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">В пути</div>
            <div className="mt-1 font-mono text-2xl font-bold text-purple-400">
              {stats.activeTracking}
            </div>
          </div>
          <div className="border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Выручка</div>
            <div className="mt-1 font-mono text-lg font-bold text-green-400">
              {stats.totalRevenue.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/orders"
          className="block border border-border bg-card p-6 transition hover:bg-muted/50"
        >
          <h3 className="font-medium">Заказы</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Трекинг посылок и статусы
          </p>
        </Link>
        <Link
          href="/admin/customers"
          className="block border border-border bg-card p-6 transition hover:bg-muted/50"
        >
          <h3 className="font-medium">Клиенты</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            База данных клиентов
          </p>
        </Link>
        <Link
          href="/admin/suppliers"
          className="block border border-border bg-card p-6 transition hover:bg-muted/50"
        >
          <h3 className="font-medium">Поставщики Yupoo</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Мониторинг каталогов
          </p>
        </Link>
        <Link
          href="/admin/finance"
          className="block border border-border bg-card p-6 transition hover:bg-muted/50"
        >
          <h3 className="font-medium">Финансы</h3>
          <p className="mt-1 text-sm text-muted-foreground">Учёт и отчёты</p>
        </Link>
        <Link
          href="/"
          className="block border border-border bg-card p-6 transition hover:bg-muted/50"
        >
          <h3 className="font-medium">Каталог</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Редактирование товаров
          </p>
        </Link>
      </div>
    </div>
  );
}
