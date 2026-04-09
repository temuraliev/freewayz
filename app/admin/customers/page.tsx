"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AdminNotesEditor } from "./admin-notes-editor";

interface Customer {
  id: number;
  _id?: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  adminNotes?: string | null;
  totalSpent: number;
  status: string;
  cashbackBalance: number;
  orderCount: number;
  lastOrderDate?: string;
}

const STATUS_COLORS: Record<string, string> = {
  ROOKIE: "bg-gray-500/20 text-gray-400",
  PRO: "bg-blue-500/20 text-blue-400",
  LEGEND: "bg-yellow-500/20 text-yellow-400",
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const initData =
    typeof window !== "undefined" && window.Telegram?.WebApp?.initData
      ? window.Telegram.WebApp.initData
      : "";

  const fetchCustomers = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        const res = await fetch(
          `/api/admin/customers?${params.toString()}`,
          {
            headers: { "X-Telegram-Init-Data": initData },
          }
        );
        if (res.ok) {
          const data = await res.json();
          setCustomers(Array.isArray(data) ? data : []);
        }
      } catch {
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    },
    [initData]
  );

  useEffect(() => {
    fetchCustomers("");
  }, [initData, fetchCustomers]);

  const handleSearch = () => {
    fetchCustomers(search);
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Клиенты</h2>
        <Link
          href="/admin"
          className="text-sm text-muted-foreground underline"
        >
          Дашборд
        </Link>
      </div>

      <div className="mb-4 text-sm text-muted-foreground">
        Всего: {customers.length} клиентов
      </div>

      {/* Search */}
      <div className="mb-4 flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Поиск по username, имени или Telegram ID..."
          className="flex-1 border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          onClick={handleSearch}
          className="bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Найти
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[20vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
        </div>
      ) : customers.length === 0 ? (
        <p className="text-muted-foreground">Нет клиентов</p>
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <div key={c._id} className="border border-border bg-card">
              <button
                onClick={() =>
                  setExpanded(expanded === c._id ? null : c._id)
                }
                className="w-full p-4 text-left transition hover:bg-muted/50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">
                      {c.username ? `@${c.username}` : c.firstName || "—"}
                    </span>
                    {c.firstName && c.username && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        {c.firstName} {c.lastName || ""}
                      </span>
                    )}
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status] || "bg-muted text-muted-foreground"}`}
                  >
                    {c.status}
                  </span>
                </div>
                <div className="mt-1 flex gap-4 text-sm text-muted-foreground">
                  <span>
                    Потрачено:{" "}
                    <span className="font-mono">
                      {(c.totalSpent || 0).toLocaleString()} UZS
                    </span>
                  </span>
                  <span>Заказов: {c.orderCount}</span>
                  {c.cashbackBalance > 0 && (
                    <span>
                      Кэшбэк: {c.cashbackBalance.toLocaleString()}
                    </span>
                  )}
                </div>
              </button>

              {expanded === c._id && (
                <div className="border-t border-border px-4 py-3 text-sm">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Telegram ID
                      </span>
                      <span className="font-mono">{c.telegramId}</span>
                    </div>
                    {c.phone && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Телефон</span>
                        <span>{c.phone}</span>
                      </div>
                    )}
                    {c.address && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Адрес</span>
                        <span>{c.address}</span>
                      </div>
                    )}
                    {c.lastOrderDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Последний заказ
                        </span>
                        <span>
                          {new Date(c.lastOrderDate).toLocaleDateString(
                            "ru-RU"
                          )}
                        </span>
                      </div>
                    )}
                    {/* Admin notes — inline edit */}
                    <div className="mt-2">
                      <AdminNotesEditor
                        customerId={c.id}
                        initialNotes={c.adminNotes ?? ""}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
