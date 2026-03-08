"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const STATUSES = [
  "new",
  "paid",
  "ordered",
  "shipped",
  "delivered",
  "cancelled",
];

const STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  paid: "Оплачен",
  ordered: "Заказан",
  shipped: "Отправлен",
  delivered: "Доставлен",
  cancelled: "Отменён",
};

interface TrackingEvent {
  date?: string;
  status?: string;
  description?: string;
  location?: string;
}

interface OrderItem {
  title?: string;
  brand?: string;
  size?: string;
  color?: string;
  price?: number;
  quantity?: number;
}

interface Order {
  _id: string;
  orderId: string;
  total: number;
  status: string;
  trackNumber?: string;
  trackUrl?: string;
  trackingStatus?: string;
  trackingEvents?: TrackingEvent[];
  track17Registered?: boolean;
  shippingMethod?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  items?: OrderItem[];
  user?: {
    _id?: string;
    telegramId?: string;
    username?: string;
    firstName?: string;
  };
}

export default function AdminOrderDetailPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const [order, setOrder] = useState<Order | null>(null);
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
    if (!id) {
      setLoading(false);
      return;
    }
    fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
      headers: { "X-Telegram-Init-Data": initData },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !data.error) {
          setOrder(data);
          setStatus(data.status ?? "new");
          setTrackNumber(data.trackNumber ?? "");
          setTrackUrl(data.trackUrl ?? "");
          setNotes(data.notes ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, [id, initData]);

  const handleSave = async () => {
    if (!order || !id) return;
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
        setOrder((prev) =>
          prev
            ? { ...prev, status, trackNumber, trackUrl, notes }
            : null
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const quickAction = async (newStatus: string) => {
    if (!id) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, status: newStatus }),
      });
      setStatus(newStatus);
      setOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
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
        <Link
          href="/admin/orders"
          className="mt-4 inline-block text-sm underline"
        >
          Назад
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4">
      <Link
        href="/admin/orders"
        className="text-sm text-muted-foreground underline"
      >
        ← Заказы
      </Link>

      <h2 className="mt-4 text-xl font-semibold">
        Заказ #{order.orderId}
      </h2>

      {/* Quick actions */}
      {order.status === "new" && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => quickAction("ordered")}
            disabled={saving}
            className="bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Подтвердить
          </button>
          <button
            onClick={() => quickAction("cancelled")}
            disabled={saving}
            className="bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Отклонить
          </button>
        </div>
      )}

      {/* Customer */}
      {order.user && (
        <div className="mt-4 border border-border bg-card p-3">
          <div className="text-xs font-medium text-muted-foreground">
            Клиент
          </div>
          <div className="mt-1 text-sm">
            {order.user.username
              ? `@${order.user.username}`
              : order.user.firstName || "—"}
          </div>
          {order.user.telegramId && (
            <div className="text-xs text-muted-foreground">
              Telegram ID: {order.user.telegramId}
            </div>
          )}
        </div>
      )}

      {/* Items */}
      {order.items && order.items.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium">Товары</h3>
          <div className="space-y-1">
            {order.items.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b border-border py-2 text-sm"
              >
                <div>
                  <span className="font-medium">
                    {item.brand ? `${item.brand} ` : ""}
                    {item.title}
                  </span>
                  {item.size && (
                    <span className="ml-2 text-muted-foreground">
                      {item.size}
                    </span>
                  )}
                  {item.color && (
                    <span className="ml-1 text-muted-foreground">
                      {item.color}
                    </span>
                  )}
                </div>
                <span className="font-mono">
                  {((item.price || 0) * (item.quantity || 1)).toLocaleString()}{" "}
                  UZS
                </span>
              </div>
            ))}
            <div className="flex justify-between pt-2 font-medium">
              <span>Итого</span>
              <span className="font-mono">
                {(order.total || 0).toLocaleString()} UZS
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="mt-6 space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Статус
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s] || s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Трек-номер
          </label>
          <input
            value={trackNumber}
            onChange={(e) => setTrackNumber(e.target.value)}
            className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
            placeholder="Введите трек-номер..."
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Ссылка на трекинг
          </label>
          <input
            value={trackUrl}
            onChange={(e) => setTrackUrl(e.target.value)}
            className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
            placeholder="https://t.17track.net/..."
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Заметки
          </label>
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

      {/* Tracking timeline */}
      {order.trackingEvents && order.trackingEvents.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-medium">
            Трекинг{" "}
            {order.trackingStatus && (
              <span className="ml-1 text-xs text-muted-foreground">
                ({order.trackingStatus})
              </span>
            )}
          </h3>
          <div className="relative border-l-2 border-border pl-4">
            {order.trackingEvents.map((ev, i) => (
              <div key={i} className="relative mb-4 last:mb-0">
                <div className="absolute -left-[1.3rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-foreground bg-background" />
                <div className="text-sm font-medium">
                  {ev.description || ev.status || "Update"}
                </div>
                {ev.location && (
                  <div className="text-xs text-muted-foreground">
                    {ev.location}
                  </div>
                )}
                {ev.date && (
                  <div className="text-xs text-muted-foreground">
                    {new Date(ev.date).toLocaleString("ru-RU")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="mt-6 space-y-1 text-xs text-muted-foreground">
        {order.createdAt && (
          <div>Создан: {new Date(order.createdAt).toLocaleString("ru-RU")}</div>
        )}
        {order.updatedAt && (
          <div>
            Обновлён: {new Date(order.updatedAt).toLocaleString("ru-RU")}
          </div>
        )}
        {order.track17Registered && (
          <div>17track: зарегистрирован</div>
        )}
      </div>
    </div>
  );
}
