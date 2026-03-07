"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const STATUSES = ["new", "paid", "ordered", "shipped", "delivered", "cancelled"];

export default function AdminOrderDetailPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const router = useRouter();
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [trackNumber, setTrackNumber] = useState("");
  const [trackUrl, setTrackUrl] = useState("");
  const [notes, setNotes] = useState("");

  const initData =
    typeof window !== "undefined" && window.Telegram?.WebApp?.initData
      ? window.Telegram.WebApp.initData
      : "";

  useEffect(() => {
    if (!initData || !id) {
      setLoading(false);
      return;
    }
    fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: { "X-Telegram-Init-Data": initData },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setOrder(data);
          setStatus((data.status as string) ?? "new");
          setTrackNumber((data.trackNumber as string) ?? "");
          setTrackUrl((data.trackUrl as string) ?? "");
          setNotes((data.notes as string) ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, [id, initData]);

  const handleSave = async () => {
    if (!initData || !order || !id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          status,
          trackNumber: trackNumber.trim() || undefined,
          trackUrl: trackUrl.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (res.ok) {
        setOrder((prev) => (prev ? { ...prev, status, trackNumber, trackUrl, notes } : null));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">Заказ не найден</p>
        <Link href="/admin/orders" className="mt-4 inline-block text-sm underline">
          Назад к заказам
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4">
      <Link href="/admin/orders" className="text-sm text-muted-foreground underline">
        ← Заказы
      </Link>
      <h2 className="mt-4 text-xl font-semibold">Заказ #{(order.orderId as string) ?? id}</h2>
      <div className="mt-4 space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Статус</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Трек-номер</label>
          <input
            value={trackNumber}
            onChange={(e) => setTrackNumber(e.target.value)}
            className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Ссылка на трекинг</label>
          <input
            value={trackUrl}
            onChange={(e) => setTrackUrl(e.target.value)}
            className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Заметки</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-foreground px-6 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
