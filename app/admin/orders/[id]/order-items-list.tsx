"use client";

interface Item {
  title?: string;
  brand?: string;
  size?: string;
  color?: string;
  price?: number;
  quantity?: number;
}

interface Props {
  items: Item[];
  total: number;
  cost?: number | null;
}

export function OrderItemsList({ items, total, cost }: Props) {
  if (!items || items.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="mb-2 text-sm font-medium">Товары</h3>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b border-border py-2 text-sm"
          >
            <div>
              <span className="font-medium">
                {item.brand ? `${item.brand} ` : ""}
                {item.title}
              </span>
              {item.size && <span className="ml-2 text-muted-foreground">{item.size}</span>}
              {item.color && <span className="ml-1 text-muted-foreground">{item.color}</span>}
            </div>
            <span className="font-mono">
              {((item.price || 0) * (item.quantity || 1)).toLocaleString()} UZS
            </span>
          </div>
        ))}
        <div className="flex justify-between pt-2 font-medium">
          <span>Итого</span>
          <span className="font-mono">{(total || 0).toLocaleString()} UZS</span>
        </div>
        {cost != null && cost > 0 && (
          <div className="flex justify-between pt-1 text-sm text-muted-foreground">
            <span>Себестоимость</span>
            <span className="font-mono">{Number(cost).toLocaleString()} UZS</span>
          </div>
        )}
      </div>
    </div>
  );
}
