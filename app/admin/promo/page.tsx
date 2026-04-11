"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { admin as adminApi, ApiClientError } from "@/lib/api-client";

interface PromoCode {
  id: number;
  code: string;
  type: string;
  value: number;
  maxUses: number | null;
  usedCount: number;
  maxUsesPerUser: number;
  minOrderTotal: number | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  _count: { usedBy: number };
}

const TYPE_LABELS: Record<string, string> = {
  discount_percent: "Скидка %",
  discount_fixed: "Скидка фикс",
  balance_topup: "Пополнение баланса",
};

function formatValue(type: string, value: number): string {
  if (type === "discount_percent") return `${value}%`;
  return `${value.toLocaleString()} UZS`;
}

function getInitData(): string {
  if (typeof window === "undefined") return "";
  return window.Telegram?.WebApp?.initData ?? "";
}

const KEY = "/api/admin/promo";

export default function AdminPromoPage() {
  const { data: codes, isLoading } = useSWR<PromoCode[]>(KEY, fetcher, {
    revalidateOnFocus: false,
  });

  const [showForm, setShowForm] = useState(false);
  const [formCode, setFormCode] = useState("");
  const [formType, setFormType] = useState("discount_percent");
  const [formValue, setFormValue] = useState("");
  const [formMaxUses, setFormMaxUses] = useState("");
  const [formMaxPerUser, setFormMaxPerUser] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    const value = parseFloat(formValue);
    if (!formCode.trim() || isNaN(value) || value <= 0) {
      setError("Укажите код и значение");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await adminApi.createPromoCode({
        initData: getInitData(),
        code: formCode.trim(),
        type: formType,
        value,
        maxUses: formMaxUses ? parseInt(formMaxUses, 10) : undefined,
        maxUsesPerUser: parseInt(formMaxPerUser, 10) || 1,
      });
      setFormCode("");
      setFormValue("");
      setFormMaxUses("");
      setShowForm(false);
      mutate(KEY);
    } catch (e) {
      setError(e instanceof ApiClientError ? (e.message || "Ошибка создания") : "Сетевая ошибка");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    await adminApi.patchPromoCode(id, { initData: getInitData(), isActive });
    mutate(KEY);
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Промокоды</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            {showForm ? "Отмена" : "+ Создать"}
          </button>
          <Link href="/admin" className="text-sm text-muted-foreground underline">
            Дашборд
          </Link>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mb-6 border border-border bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Код</label>
              <input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                placeholder="SUMMER10"
                className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm uppercase"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Тип</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="discount_percent">Скидка %</option>
                <option value="discount_fixed">Скидка фикс (UZS)</option>
                <option value="balance_topup">Пополнение баланса</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Значение {formType === "discount_percent" ? "(%)" : "(UZS)"}
              </label>
              <input
                type="number"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                placeholder={formType === "discount_percent" ? "10" : "50000"}
                className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Макс. использований</label>
              <input
                type="number"
                value={formMaxUses}
                onChange={(e) => setFormMaxUses(e.target.value)}
                placeholder="∞"
                className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">На юзера</label>
              <input
                type="number"
                value={formMaxPerUser}
                onChange={(e) => setFormMaxPerUser(e.target.value)}
                placeholder="1"
                className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={saving}
            className="bg-foreground px-6 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {saving ? "Создание…" : "Создать промокод"}
          </button>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex min-h-[20vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
        </div>
      ) : !codes || codes.length === 0 ? (
        <p className="text-muted-foreground">Нет промокодов</p>
      ) : (
        <div className="space-y-2">
          {codes.map((c) => (
            <div
              key={c.id}
              className={`border bg-card p-4 flex items-center justify-between ${
                c.isActive ? "border-border" : "border-border/40 opacity-60"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-lg">{c.code}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      c.isActive
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {c.isActive ? "Активен" : "Отключён"}
                  </span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {TYPE_LABELS[c.type] || c.type}: <strong>{formatValue(c.type, c.value)}</strong>
                  {" · "}
                  Использований: {c.usedCount}{c.maxUses ? `/${c.maxUses}` : "/∞"}
                  {c.minOrderTotal ? ` · Мин. заказ: ${c.minOrderTotal.toLocaleString()} UZS` : ""}
                </div>
                {c.expiresAt && (
                  <div className="text-xs text-muted-foreground">
                    До: {new Date(c.expiresAt).toLocaleDateString("ru-RU")}
                  </div>
                )}
              </div>
              <button
                onClick={() => toggleActive(c.id, !c.isActive)}
                className={`px-3 py-1.5 text-xs font-medium ${
                  c.isActive
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                }`}
              >
                {c.isActive ? "Отключить" : "Включить"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
