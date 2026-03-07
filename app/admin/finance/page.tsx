"use client";

import { useEffect, useState } from "react";

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
  totalExpense: number;
  profit: number;
}

export default function AdminFinancePage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);

  const initData =
    typeof window !== "undefined" && window.Telegram?.WebApp?.initData
      ? window.Telegram.WebApp.initData
      : "";

  useEffect(() => {
    if (!initData) {
      setLoading(false);
      return;
    }
    fetch("/api/admin/finance", {
      method: "GET",
      headers: { "X-Telegram-Init-Data": initData },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, [initData]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
      </div>
    );
  }

  if (!data) {
    return <div className="p-4 text-muted-foreground">Не удалось загрузить данные</div>;
  }

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-semibold">Финансы</h2>
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">Доход</div>
          <div className="mt-1 font-mono text-lg font-bold">{data.revenue.toLocaleString()} UZS</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">Расходы</div>
          <div className="mt-1 font-mono text-lg font-bold">{data.totalExpense.toLocaleString()} UZS</div>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">Прибыль</div>
          <div className="mt-1 font-mono text-lg font-bold">{data.profit.toLocaleString()} UZS</div>
        </div>
      </div>
      <h3 className="mb-2 font-medium">Последние расходы</h3>
      {data.expenses.length === 0 ? (
        <p className="text-muted-foreground">Нет записей. Добавьте через бота: /expense &lt;сумма&gt; &lt;описание&gt;</p>
      ) : (
        <div className="space-y-2">
          {data.expenses.slice(0, 30).map((e) => (
            <div key={e._id} className="flex justify-between border-b border-border py-2 text-sm">
              <span>{new Date(e.date).toLocaleDateString()} — {e.category}</span>
              <span className="font-mono">{e.amount} {e.currency}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
