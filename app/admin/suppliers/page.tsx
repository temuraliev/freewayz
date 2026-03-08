"use client";

import { useEffect, useState } from "react";

interface Supplier {
  _id: string;
  name: string;
  url: string;
  lastCheckedAt?: string;
  lastAlbumCount?: number;
  isActive?: boolean;
}

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const initData =
    typeof window !== "undefined" && window.Telegram?.WebApp?.initData
      ? window.Telegram.WebApp.initData
      : "";

  useEffect(() => {
    fetch("/api/admin/suppliers", {
      method: "GET",
      headers: { "X-Telegram-Init-Data": initData },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSuppliers(Array.isArray(data) ? data : []))
      .catch(() => setSuppliers([]))
      .finally(() => setLoading(false));
  }, [initData]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-semibold">Поставщики Yupoo</h2>
      {suppliers.length === 0 ? (
        <p className="text-muted-foreground">Нет поставщиков. Добавьте через бота: /addsupplier &lt;url&gt;</p>
      ) : (
        <div className="space-y-2">
          {suppliers.map((s) => (
            <div
              key={s._id}
              className="border border-border bg-card p-4"
            >
              <div className="font-medium">{s.name}</div>
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
                {s.lastCheckedAt && ` · Проверено: ${new Date(s.lastCheckedAt).toLocaleDateString()}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
