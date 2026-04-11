"use client";

import type { OrderFormState } from "./use-order-detail";

const STATUSES = ["new", "paid", "ordered", "shipped", "delivered", "cancelled"];

const STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  paid: "Оплачен",
  ordered: "Заказан",
  shipped: "Отправлен",
  delivered: "Доставлен",
  cancelled: "Отменён",
};

interface Props {
  form: OrderFormState;
  saving: boolean;
  onChange: (patch: Partial<OrderFormState>) => void;
  onSave: () => void;
}

export function OrderStatusForm({ form, saving, onChange, onSave }: Props) {
  return (
    <div className="mt-6 space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Статус</label>
        <select
          value={form.status}
          onChange={(e) => onChange({ status: e.target.value })}
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
        <label className="text-xs font-medium text-muted-foreground">Трек-номер</label>
        <input
          value={form.trackNumber}
          onChange={(e) => onChange({ trackNumber: e.target.value })}
          className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
          placeholder="Введите трек-номер..."
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Ссылка на трекинг</label>
        <input
          value={form.trackUrl}
          onChange={(e) => onChange({ trackUrl: e.target.value })}
          className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
          placeholder="https://t.17track.net/..."
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Заметки</label>
        <textarea
          value={form.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={2}
          className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Себестоимость заказа (UZS)
        </label>
        <input
          type="number"
          min={0}
          step={1000}
          value={form.cost}
          onChange={(e) => onChange({ cost: e.target.value })}
          placeholder="0"
          className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
        />
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Затраты на заказ (закуп, доставка). Учитываются в прибыли в разделе Финансы.
        </p>
      </div>
      <button
        onClick={onSave}
        disabled={saving}
        className="bg-foreground px-6 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {saving ? "Сохранение…" : "Сохранить"}
      </button>
    </div>
  );
}
