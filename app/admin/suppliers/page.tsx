"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/lib/swr-fetcher";

interface Supplier {
  _id: string;
  name: string;
  url: string;
  lastCheckedAt?: string;
  lastAlbumCount?: number;
  isActive?: boolean;
}

function getInitData(): string {
  if (typeof window === "undefined") return "";
  return window.Telegram?.WebApp?.initData ?? "";
}

const KEY = "/api/admin/suppliers";

export default function AdminSuppliersPage() {
  const { data: suppliers, isLoading } = useSWR<Supplier[]>(KEY, fetcher, {
    revalidateOnFocus: false,
  });

  const [showForm, setShowForm] = useState(false);
  const [formUrl, setFormUrl] = useState("");
  const [formName, setFormName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!formUrl.trim()) return;
    setSaving(true);
    try {
      const name = formName.trim() || formUrl.replace(/^https?:\/\//, "").split("/")[0];
      await fetch("/api/admin/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: getInitData(),
          name,
          url: formUrl.trim(),
        }),
      });
      setFormUrl("");
      setFormName("");
      setShowForm(false);
      mutate(KEY);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Поставщики Yupoo</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            {showForm ? "Отмена" : "+ Добавить"}
          </button>
          <Link href="/admin" className="text-sm text-muted-foreground underline">
            Дашборд
          </Link>
        </div>
      </div>

      {showForm && (
        <div className="mb-6 border border-border bg-card p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">URL поставщика</label>
            <input
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://example.x.yupoo.com"
              className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Название (опционально)</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Автоматически из URL"
              className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !formUrl.trim()}
            className="bg-foreground px-6 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {saving ? "Добавление…" : "Добавить поставщика"}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-[20vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
        </div>
      ) : !suppliers || suppliers.length === 0 ? (
        <p className="text-muted-foreground">Нет поставщиков</p>
      ) : (
        <div className="space-y-2">
          {suppliers.map((s) => (
            <div key={s._id} className="border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">{s.name}</div>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    s.isActive !== false
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {s.isActive !== false ? "Активен" : "Отключён"}
                </span>
              </div>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block truncate text-sm text-muted-foreground underline"
              >
                {s.url}
              </a>
              <div className="mt-1 text-xs text-muted-foreground">
                Альбомов: {s.lastAlbumCount ?? "—"}
                {s.lastCheckedAt &&
                  ` · Проверено: ${new Date(s.lastCheckedAt).toLocaleDateString("ru-RU")}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
