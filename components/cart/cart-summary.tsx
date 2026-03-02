"use client";

import { useCartStore, useUserStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, ExternalLink, Tag, X, Loader2 } from "lucide-react";
import { ru, itemsCount } from "@/lib/i18n/ru";
import { sanitizeInput } from "@/lib/sanitize";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface PromoState {
  code: string;
  status: "idle" | "loading" | "valid" | "error";
  message: string;
  type?: "percentage" | "fixed";
  value?: number;
  discount: number;
}

export function CartSummary() {
  const { items, getTotal, clearCart } = useCartStore();
  const { telegramUser } = useUserStore();
  const total = getTotal();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Promo code state
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<PromoState>({
    code: "",
    status: "idle",
    message: "",
    discount: 0,
  });

  const finalTotal = Math.max(0, total - promo.discount);

  const handleApplyPromo = async () => {
    const code = sanitizeInput(promoInput).toUpperCase().trim();
    if (!code) return;

    setPromo((prev) => ({ ...prev, status: "loading", message: "" }));

    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, orderTotal: total }),
      });

      const data = await res.json();

      if (res.ok && data.valid) {
        setPromo({
          code: data.code,
          status: "valid",
          message: data.type === "percentage"
            ? `-${data.value}%`
            : `-${formatPrice(data.discount)}`,
          type: data.type,
          value: data.value,
          discount: data.discount,
        });
      } else {
        setPromo({
          code: "",
          status: "error",
          message: data.error || ru.promoInvalid,
          discount: 0,
        });
      }
    } catch {
      setPromo({
        code: "",
        status: "error",
        message: ru.promoInvalid,
        discount: 0,
      });
    }
  };

  const handleClearPromo = () => {
    setPromoInput("");
    setPromo({ code: "", status: "idle", message: "", discount: 0 });
  };

  const handleCheckout = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const rawUsername = telegramUser?.username || "guest";

    const cartItems = items.map((item) => ({
      brand: sanitizeInput(typeof item.product.brand === 'string' ? item.product.brand : (item.product.brand?.title ?? '')),
      title: sanitizeInput(item.product.title),
      size: item.size,
      color: item.color ?? '',
      price: item.product.price * item.quantity,
    }));

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: rawUsername,
          items: cartItems,
          total: finalTotal,
          promoCode: promo.code || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.checkoutUrl) {
          window.open(data.checkoutUrl, "_blank");
          setIsSubmitting(false);
          return;
        }
      }

      console.warn("[CartSummary] Server checkout failed, using fallback");
    } catch (error) {
      console.warn("[CartSummary] Checkout fetch error:", error);
    }

    // Fallback
    const { generateCheckoutMessage, getTelegramCheckoutUrl } = await import("@/lib/utils");
    const message = generateCheckoutMessage(sanitizeInput(rawUsername), cartItems, finalTotal);
    const checkoutUrl = getTelegramCheckoutUrl(message);
    window.open(checkoutUrl, "_blank");
    setIsSubmitting(false);
  };

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
        {/* Promo Code Input */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Tag className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
              placeholder={ru.promoCodePlaceholder}
              disabled={promo.status === "valid"}
              className={cn(
                "h-9 w-full rounded-lg border bg-secondary/50 pl-9 pr-3 text-sm font-mono",
                "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20",
                promo.status === "valid"
                  ? "border-green-500/50 text-green-400"
                  : promo.status === "error"
                    ? "border-red-500/50"
                    : "border-border"
              )}
            />
          </div>
          {promo.status === "valid" ? (
            <button
              onClick={handleClearPromo}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleApplyPromo}
              disabled={promo.status === "loading" || !promoInput.trim()}
              className="flex h-9 items-center justify-center rounded-lg border border-border bg-secondary/50 px-3 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {promo.status === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                ru.promoApply
              )}
            </button>
          )}
        </div>

        {/* Promo feedback */}
        <AnimatePresence>
          {promo.status === "valid" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-green-400">
                {ru.promoApplied}: {promo.code}
              </span>
              <span className="font-mono text-green-400">
                {promo.message}
              </span>
            </motion.div>
          )}
          {promo.status === "error" && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-red-400"
            >
              {promo.message}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Summary Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShoppingBag className="h-4 w-4" />
            <span className="text-sm">
              {itemsCount(items.length)}
            </span>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{ru.total}</p>
            <div className="flex items-center gap-2">
              {promo.discount > 0 && (
                <span className="font-mono text-sm text-muted-foreground line-through">
                  {formatPrice(total)}
                </span>
              )}
              <p className={cn(
                "font-mono text-xl font-bold",
                promo.discount > 0 ? "text-green-400" : ""
              )}>
                {formatPrice(finalTotal)}
              </p>
            </div>
          </div>
        </div>

        {/* Checkout Button */}
        <Button
          onClick={handleCheckout}
          size="lg"
          className="w-full gap-2 text-base"
          disabled={isSubmitting}
        >
          {ru.checkoutViaTelegram}
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}
