"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShoppingBag, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { CartItem } from "@/components/cart/cart-item";
import { CartSummary } from "@/components/cart/cart-summary";
import { Button } from "@/components/ui/button";
import { useCartStore, useTierStore } from "@/lib/store";
import { ru, itemsCount } from "@/lib/i18n/ru";
import { Product } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

interface CrossSellProduct {
  _id: string;
  title: string;
  slug: { current: string };
  price: number;
  images?: string[];
  brand?: { title: string; slug: { current: string } };
  subtype?: string;
  isOnSale?: boolean;
}

export default function CartPage() {
  const router = useRouter();
  const { items, clearCart, addItem } = useCartStore();
  const tier = useTierStore((s) => s.tier);
  const [crossSell, setCrossSell] = useState<CrossSellProduct[]>([]);

  const fetchCrossSell = useCallback(async () => {
    if (items.length === 0) {
      setCrossSell([]);
      return;
    }

    const subtypes = [
      ...new Set(
        items
          .map((i) => i.product.subtype?.toLowerCase())
          .filter(Boolean) as string[]
      ),
    ];
    const brands = [
      ...new Set(
        items
          .map((i) => i.product.brand?.slug?.current)
          .filter(Boolean) as string[]
      ),
    ];
    const excludeIds = items.map((i) => i.product._id);
    const maxPrice = Math.max(...items.map((i) => i.product.price));

    const params = new URLSearchParams();
    if (subtypes.length) params.set("subtypes", subtypes.join(","));
    if (brands.length) params.set("brands", brands.join(","));
    if (excludeIds.length) params.set("exclude", excludeIds.join(","));
    params.set("maxPrice", String(maxPrice));
    params.set("tier", tier);

    try {
      const res = await fetch(`/api/cross-sell?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCrossSell(data.products || []);
      }
    } catch {
      /* ignore */
    }
  }, [items, tier]);

  useEffect(() => {
    fetchCrossSell();
  }, [fetchCrossSell]);

  const handleQuickAdd = (p: CrossSellProduct) => {
    addItem(p as unknown as Product, "One Size", null);
  };

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
          <div className="w-16" />
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

            {/* Cross-sell section */}
            {crossSell.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Дополни заказ
                </h3>
                <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
                  {crossSell.map((p) => (
                    <div
                      key={p._id}
                      className="w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-card"
                    >
                      <Link href={`/product/${p.slug.current}`}>
                        <div className="relative aspect-square bg-secondary">
                          {p.images?.[0] ? (
                            <Image
                              src={p.images[0]}
                              alt={p.title}
                              fill
                              className="object-cover"
                              sizes="128px"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                              Нет фото
                            </div>
                          )}
                        </div>
                      </Link>
                      <div className="p-2">
                        <p className="line-clamp-1 text-xs">{p.title}</p>
                        <p className="mt-0.5 text-xs font-semibold">
                          {formatPrice(p.price)}
                        </p>
                        <button
                          onClick={() => handleQuickAdd(p)}
                          className="mt-1.5 flex w-full items-center justify-center gap-1 rounded border border-border py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary"
                        >
                          <Plus className="h-3 w-3" />
                          Добавить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cart Summary (Sticky at bottom) */}
      <CartSummary />
    </div>
  );
}
