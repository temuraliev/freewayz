"use client";

import { useState } from "react";
import { useCartStore, useUserStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { motion } from "framer-motion";
import { ShoppingBag, Check, Loader2 } from "lucide-react";
import { ru, itemsCount } from "@/lib/i18n/ru";

export function CartSummary() {
  const { items, getTotal, clearCart } = useCartStore();
  const { telegramUser } = useUserStore();
  const total = getTotal();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    const initData =
      typeof window !== "undefined" && window.Telegram?.WebApp?.initData
        ? window.Telegram.WebApp.initData
        : "";

    if (!initData) {
      setError("Откройте приложение через Telegram");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cartItems = items.map((item) => ({
        productId: item.product._id,
        title: item.product.title,
        brand:
          typeof item.product.brand === "string"
            ? item.product.brand
            : (item.product.brand?.title ?? ""),
        size: item.size,
        color: item.color ?? "",
        price: item.product.price * item.quantity,
        quantity: item.quantity,
      }));

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, items: cartItems, total }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Не удалось оформить заказ");
        return;
      }

      setSuccess(data.orderId);
      clearCart();
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-20 left-0 right-0 z-40 border-t border-border bg-background/95 p-4 backdrop-blur-lg safe-bottom"
      >
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
            <Check className="h-5 w-5 text-green-500" />
          </div>
          <p className="font-medium">Заказ #{success} оформлен!</p>
          <p className="text-sm text-muted-foreground">
            Мы скоро свяжемся с вами
          </p>
        </div>
      </motion.div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-20 left-0 right-0 z-40 border-t border-border bg-background/95 p-4 backdrop-blur-lg safe-bottom"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShoppingBag className="h-4 w-4" />
            <span className="text-sm">{itemsCount(items.length)}</span>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{ru.total}</p>
            <p className="font-mono text-xl font-bold">{formatPrice(total)}</p>
          </div>
        </div>

        {error && (
          <p className="text-center text-sm text-red-500">{error}</p>
        )}

        <Button
          onClick={handleCheckout}
          size="lg"
          className="w-full gap-2 text-base"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Оформление...
            </>
          ) : (
            "Оформить заказ"
          )}
        </Button>
      </div>
    </motion.div>
  );
}
