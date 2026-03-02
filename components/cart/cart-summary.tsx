"use client";

import { useCartStore, useUserStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { formatPrice, generateCheckoutMessage, getTelegramCheckoutUrl } from "@/lib/utils";
import { motion } from "framer-motion";
import { ShoppingBag, ExternalLink } from "lucide-react";
import { ru, itemsCount } from "@/lib/i18n/ru";

export function CartSummary() {
  const { items, getTotal, clearCart } = useCartStore();
  const { telegramUser } = useUserStore();
  const total = getTotal();

  const handleCheckout = () => {
    const username = telegramUser?.username || "guest";
    
    const cartItems = items.map((item) => ({
      brand: typeof item.product.brand === 'string' ? item.product.brand : (item.product.brand?.title ?? ''),
      title: item.product.title,
      size: item.size,
      color: item.color ?? '',
      price: item.product.price * item.quantity,
    }));

    const message = generateCheckoutMessage(username, cartItems, total);
    const checkoutUrl = getTelegramCheckoutUrl(message);

    // Open Telegram with pre-filled message
    window.open(checkoutUrl, "_blank");
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
            <p className="font-mono text-xl font-bold">{formatPrice(total)}</p>
          </div>
        </div>

        {/* Checkout Button */}
        <Button
          onClick={handleCheckout}
          size="lg"
          className="w-full gap-2 text-base"
        >
          {ru.checkoutViaTelegram}
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}
