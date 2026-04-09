"use client";

import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { AlertTriangle, Info } from "lucide-react";

interface Alert {
  type: "warning" | "info";
  text: string;
  link: string | null;
}

interface DashboardData {
  alerts: Alert[];
  stats: {
    totalOrders: number;
    totalRevenue: number;
    ordersInTransit: number;
    totalCustomers: number;
    newOrdersCount: number;
  };
}

export default function AdminDashboardPage() {
  const { data } = useSWR<DashboardData>("/api/admin/dashboard", fetcher, {
    refreshInterval: 30_000, // auto-refresh every 30s
    revalidateOnFocus: true,
  });

  const stats = data?.stats;
  const alerts = data?.alerts ?? [];

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-semibold">Дашборд</h2>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.map((a, i) => {
            const Icon = a.type === "warning" ? AlertTriangle : Info;
            const colors =
              a.type === "warning"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                : "border-blue-500/30 bg-blue-500/10 text-blue-400";
            const content = (
              <div className={`flex items-center gap-3 border p-3 ${colors}`}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="text-sm">{a.text}</span>
              </div>
            );
            return a.link ? (
              <Link key={i} href={a.link} className="block hover:opacity-80 transition">
                {content}
              </Link>
            ) : (
              <div key={i}>{content}</div>
            );
          })}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Всего заказов</div>
            <div className="mt-1 font-mono text-2xl font-bold">{stats.totalOrders}</div>
          </div>
          <div className="border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Новых</div>
            <div className="mt-1 font-mono text-2xl font-bold text-blue-400">
              {stats.newOrdersCount}
            </div>
          </div>
          <div className="border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">В пути</div>
            <div className="mt-1 font-mono text-2xl font-bold text-purple-400">
              {stats.ordersInTransit}
            </div>
          </div>
          <div className="border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Выручка</div>
            <div className="mt-1 font-mono text-lg font-bold text-green-400">
              {stats.totalRevenue.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">UZS</span>
            </div>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/orders"
          className="block border border-border bg-card p-5 transition hover:bg-muted/50"
        >
          <h3 className="font-medium">Заказы</h3>
          <p className="mt-1 text-sm text-muted-foreground">Трекинг и статусы</p>
        </Link>
        <Link
          href="/admin/customers"
          className="block border border-border bg-card p-5 transition hover:bg-muted/50"
        >
          <h3 className="font-medium">Клиенты</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats ? `${stats.totalCustomers} клиентов` : "База данных"}
          </p>
        </Link>
        <Link
          href="/admin/promo"
          className="block border border-border bg-card p-5 transition hover:bg-muted/50"
        >
          <h3 className="font-medium">Промокоды</h3>
          <p className="mt-1 text-sm text-muted-foreground">Создание и управление</p>
        </Link>
        <Link
          href="/admin/suppliers"
          className="block border border-border bg-card p-5 transition hover:bg-muted/50"
        >
          <h3 className="font-medium">Поставщики</h3>
          <p className="mt-1 text-sm text-muted-foreground">Мониторинг Yupoo</p>
        </Link>
        <Link
          href="/admin/finance"
          className="block border border-border bg-card p-5 transition hover:bg-muted/50"
        >
          <h3 className="font-medium">Финансы</h3>
          <p className="mt-1 text-sm text-muted-foreground">Учёт и графики</p>
        </Link>
        <Link
          href="/"
          className="block border border-border bg-card p-5 transition hover:bg-muted/50"
        >
          <h3 className="font-medium">Каталог</h3>
          <p className="mt-1 text-sm text-muted-foreground">Редактирование товаров</p>
        </Link>
      </div>
    </div>
  );
}
