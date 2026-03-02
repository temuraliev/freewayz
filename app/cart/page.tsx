"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { CartItem } from "@/components/cart/cart-item";
import { CartSummary } from "@/components/cart/cart-summary";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/store";
import { ru, itemsCount } from "@/lib/i18n/ru";

export default function CartPage() {
  const router = useRouter();
  const { items, clearCart } = useCartStore();

  return (
    <div className="min-h-screen pb-48">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="flex h-14 items-center justify-between px-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
            {ru.back}
          </button>
          <h1 className="font-headline text-lg tracking-wider">{ru.cart}</h1>
          <div className="w-16" /> {/* Spacer for alignment */}
        </div>
      </div>

      {/* Cart Content */}
      <div className="p-4">
        {items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex min-h-[60vh] flex-col items-center justify-center text-center"
          >
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
              <ShoppingBag className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">{ru.yourCartIsEmpty}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {ru.cartEmptyHint}
            </p>
            <Button
              onClick={() => router.push("/")}
              className="mt-6"
              variant="outline"
            >
              {ru.continueShopping}
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {/* Clear Cart Button */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {itemsCount(items.length)}
              </p>
              <button
                onClick={clearCart}
                className="text-xs text-muted-foreground underline transition-colors hover:text-foreground"
              >
                {ru.clearAll}
              </button>
            </div>

            {/* Cart Items */}
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <CartItem
                  key={`${item.product._id}-${item.size}-${item.color}`}
                  item={item}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Cart Summary (Sticky at bottom) */}
      <CartSummary />
    </div>
  );
}
