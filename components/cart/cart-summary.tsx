"use client";

import { useState } from "react";
import { useCartStore, useUserStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { formatPrice, getStatusDiscount } from "@/lib/utils";
import { ymTrack } from "@/components/providers/yandex-metrica";
import { motion } from "framer-motion";
import { ShoppingBag, Check, Loader2, Tag, X, Crown } from "lucide-react";
import { ru, itemsCount } from "@/lib/i18n/ru";

interface AppliedPromo {
  code: string;
  type: "discount_percent" | "discount_fixed";
  value: number;
}

export function CartSummary() {
  const { items, getTotal, clearCart } = useCartStore();
  const { user } = useUserStore();
  const total = getTotal();
  const loyaltyDiscountPercent = getStatusDiscount(user?.status);
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);

  // Loyalty discount only applies if no promo code is active
  const loyaltyDiscountAmount = !appliedPromo && loyaltyDiscountPercent > 0
    ? Math.round(total * (loyaltyDiscountPercent / 100))
    : 0;

  const promoDiscountAmount = appliedPromo
    ? appliedPromo.type === "discount_percent"
      ? Math.round(total * (appliedPromo.value / 100))
      : Math.min(appliedPromo.value, total)
    : 0;

  const discountAmount = loyaltyDiscountAmount || promoDiscountAmount;
  const finalTotal = total - discountAmount;

  const handleApplyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;

    setPromoLoading(true);
    setPromoError(null);

    const initData =
      typeof window !== "undefined" && window.Telegram?.WebApp?.initData
        ? window.Telegram.WebApp.initData
        : "";

    try {
      const res = await fetch("/api/promo/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, code, context: "cart" }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setPromoError(data.error || "Ошибка");
        return;
      }
      if (data.type === "balance_topup") {
        setPromoError("Этот промокод для пополнения баланса. Активируйте его в профиле.");
        return;
      }
      if (data.minOrderTotal && total < data.minOrderTotal) {
        setPromoError(`Минимальная сумма заказа: ${formatPrice(data.minOrderTotal)}`);
        return;
      }
      setAppliedPromo({
        code: data.code || code,
        type: data.type,
        value: data.value,
      });
    } catch {
      setPromoError("Ошибка сети");
    } finally {
      setPromoLoading(false);
    }
  };

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

    ymTrack("checkout_click", { 
      total: finalTotal, 
      items: items.length 
    });

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
        body: JSON.stringify({
          initData,
          items: cartItems,
          total: finalTotal,
          promoCode: appliedPromo?.code || undefined,
          discount: discountAmount || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Не удалось оформить заказ");
        return;
      }

      setSuccess(data.orderId);
      clearCart();
      setAppliedPromo(null);
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
        {/* Promo code or Loyalty Discount */}
        {appliedPromo ? (
          <div className="flex items-center justify-between rounded border border-green-500/30 bg-green-500/10 px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <Tag className="h-3.5 w-3.5 text-green-500" />
              <span className="font-medium text-green-500">
                {appliedPromo.code}
              </span>
              <span className="text-muted-foreground">
                −{appliedPromo.type === "discount_percent"
                  ? `${appliedPromo.value}%`
                  : formatPrice(appliedPromo.value)}
              </span>
            </div>
            <button
              onClick={() => {
                setAppliedPromo(null);
                setPromoInput("");
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => {
                    setPromoInput(e.target.value);
                    setPromoError(null);
                  }}
                  placeholder="Промокод"
                  className="h-9 w-full rounded border border-border bg-secondary pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 shrink-0"
                disabled={promoLoading || !promoInput.trim()}
                onClick={handleApplyPromo}
              >
                {promoLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Применить"
                )}
              </Button>
            </div>
            
            {loyaltyDiscountPercent > 0 && (
              <div className="flex items-center justify-between rounded border border-primary/30 bg-primary/5 px-3 py-1.5">
                <div className="flex items-center gap-2 text-[12px]">
                  <Crown className="h-3 w-3 text-primary" />
                  <span className="font-medium text-primary uppercase tracking-wider">
                    {user?.status} Скидка
                  </span>
                  <span className="text-muted-foreground">
                    −{loyaltyDiscountPercent}%
                  </span>
                </div>
                <span className="text-[9px] text-muted-foreground uppercase opacity-70">Автоматически</span>
              </div>
            )}
          </div>
        )}
        {promoError && (
          <p className="text-xs text-red-500">{promoError}</p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShoppingBag className="h-4 w-4" />
            <span className="text-sm">{itemsCount(items.length)}</span>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{ru.total}</p>
            {discountAmount > 0 ? (
              <>
                <p className="text-xs text-muted-foreground line-through">
                  {formatPrice(total)}
                </p>
                <p className="font-mono text-xl font-bold text-green-500">
                  {formatPrice(finalTotal)}
                </p>
              </>
            ) : (
              <p className="font-mono text-xl font-bold">
                {formatPrice(total)}
              </p>
            )}
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
