"use client";

import { useParams } from "next/navigation";
import Link from "next/link";

import { useOrderDetail } from "./use-order-detail";
import { OrderItemsList } from "./order-items-list";
import { OrderStatusForm } from "./order-status-form";
import { TrackingTimeline } from "./tracking-timeline";

export default function AdminOrderDetailPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const { order, loading, saving, form, updateForm, save, quickAction } =
    useOrderDetail(id);

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
          Назад
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4">
      <Link href="/admin/orders" className="text-sm text-muted-foreground underline">
        ← Заказы
      </Link>

      <h2 className="mt-4 text-xl font-semibold">Заказ #{order.orderId}</h2>

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
          <div className="text-xs font-medium text-muted-foreground">Клиент</div>
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

      <OrderItemsList items={order.items || []} total={order.total} cost={order.cost} />

      <OrderStatusForm form={form} saving={saving} onChange={updateForm} onSave={save} />

      <TrackingTimeline
        events={order.trackingEvents || []}
        trackingStatus={order.trackingStatus}
      />

      {/* Meta */}
      <div className="mt-6 space-y-1 text-xs text-muted-foreground">
        {order.createdAt && (
          <div>Создан: {new Date(order.createdAt).toLocaleString("ru-RU")}</div>
        )}
        {order.updatedAt && (
          <div>Обновлён: {new Date(order.updatedAt).toLocaleString("ru-RU")}</div>
        )}
        {order.track17Registered && <div>17track: зарегистрирован</div>}
      </div>
    </div>
  );
}
