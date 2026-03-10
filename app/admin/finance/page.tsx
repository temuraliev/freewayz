"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Expense {
  _id: string;
  date: string;
  amount: number;
  currency: string;
  category: string;
  description?: string;
}

interface FinanceData {
  expenses: Expense[];
  revenue: number;
  costOfGoods: number;
  totalExpense: number;
  profit: number;
}

const CATEGORIES = ["shipping", "purchase", "packaging", "other"] as const;
const CURRENCIES = ["UZS", "CNY", "USD"] as const;

const CAT_LABELS: Record<string, string> = {
  shipping: "Доставка",
  purchase: "Закупка",
  packaging: "Упаковка",
  other: "Другое",
};

export default function AdminFinancePage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formAmount, setFormAmount] = useState("");
  const [formCurrency, setFormCurrency] = useState<string>("UZS");
  const [formCategory, setFormCategory] = useState<string>("other");
  const [formDesc, setFormDesc] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  const initData =
    typeof window !== "undefined" && window.Telegram?.WebApp?.initData
      ? window.Telegram.WebApp.initData
      : "";

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await fetch(`/api/admin/finance?${params.toString()}`, {
        headers: { "X-Telegram-Init-Data": initData },
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [initData, fromDate, toDate]);

  useEffect(() => {
    fetchData();
  }, [initData, fetchData]);

  const handleAddExpense = async () => {
    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) return;

    setFormSaving(true);
    try {
      const res = await fetch("/api/admin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          date: new Date().toISOString(),
          amount,
          currency: formCurrency,
          category: formCategory,
          description: formDesc.trim(),
        }),
      });
      if (res.ok) {
        setFormAmount("");
        setFormDesc("");
        setShowForm(false);
        fetchData();
      }
    } finally {
      setFormSaving(false);
    }
  };

  const categoryBreakdown = data?.expenses
    ? data.expenses.reduce(
        (acc, e) => {
          const cat = e.category || "other";
          acc[cat] = (acc[cat] || 0) + (e.currency === "UZS" ? e.amount : e.amount * 1600);
          return acc;
        },
        {} as Record<string, number>
      )
    : {};

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-muted-foreground">Не удалось загрузить данные</div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Финансы</h2>
        <Link
          href="/admin"
          className="text-sm text-muted-foreground underline"
        >
          Дашборд
        </Link>
      </div>

      {/* Summary cards: Доход − Себестоимость − Расходы = Прибыль */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border border-border bg-card p-3">
          <div className="text-xs font-medium text-muted-foreground">
            Доход
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-green-400">
            {data.revenue.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground">UZS</div>
        </div>
        <div className="border border-border bg-card p-3">
          <div className="text-xs font-medium text-muted-foreground">
            Себестоимость заказов
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-amber-500">
            {(data.costOfGoods ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground">UZS</div>
        </div>
        <div className="border border-border bg-card p-3">
          <div className="text-xs font-medium text-muted-foreground">
            Расходы
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-red-400">
            {data.totalExpense.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground">UZS</div>
        </div>
        <div className="border border-border bg-card p-3">
          <div className="text-xs font-medium text-muted-foreground">
            Прибыль
          </div>
          <div
            className={`mt-1 font-mono text-lg font-bold ${data.profit >= 0 ? "text-green-400" : "text-red-400"}`}
          >
            {data.profit.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground">Доход − себестоимость − расходы</div>
        </div>
      </div>

      {/* Date range filter */}
      <div className="mb-4 flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">С</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1 w-full border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">По</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1 w-full border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={fetchData}
          className="mt-5 bg-foreground px-3 py-1.5 text-xs font-medium text-background"
        >
          Применить
        </button>
      </div>

      {/* Category breakdown */}
      {Object.keys(categoryBreakdown).length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-medium">По категориям</h3>
          <div className="space-y-1">
            {Object.entries(categoryBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, amount]) => (
                <div
                  key={cat}
                  className="flex justify-between text-sm"
                >
                  <span>{CAT_LABELS[cat] || cat}</span>
                  <span className="font-mono">
                    {amount.toLocaleString()} UZS
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Add expense */}
      <div className="mb-4">
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          {showForm ? "Скрыть" : "Добавить расход"}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 space-y-3 border border-border bg-card p-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Сумма</label>
              <input
                type="number"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0"
                className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Валюта</label>
              <select
                value={formCurrency}
                onChange={(e) => setFormCurrency(e.target.value)}
                className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Категория</label>
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CAT_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Описание</label>
            <input
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Описание..."
              className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleAddExpense}
            disabled={formSaving}
            className="bg-foreground px-6 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {formSaving ? "Сохранение…" : "Записать"}
          </button>
        </div>
      )}

      {/* Expenses list */}
      <h3 className="mb-2 font-medium">Расходы</h3>
      {data.expenses.length === 0 ? (
        <p className="text-muted-foreground">Нет записей</p>
      ) : (
        <div className="space-y-1">
          {data.expenses.map((e) => (
            <div
              key={e._id}
              className="flex items-center justify-between border-b border-border py-2 text-sm"
            >
              <div>
                <span className="text-muted-foreground">
                  {new Date(e.date).toLocaleDateString("ru-RU")}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {CAT_LABELS[e.category] || e.category}
                </span>
                {e.description && (
                  <span className="ml-2">{e.description}</span>
                )}
              </div>
              <span className="font-mono">
                {e.amount.toLocaleString()} {e.currency}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
