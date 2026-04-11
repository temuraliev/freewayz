"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { CartItem as CartItemType } from "@shared/types";
import { useCartStore } from "@frontend/stores";
import { formatPrice } from "@shared/utils";
import { ru } from "@shared/i18n/ru";

interface CartItemProps {
  item: CartItemType;
}

export function CartItem({ item }: CartItemProps) {
  const { updateQuantity, removeItem } = useCartStore();
  const { product, size, color, quantity } = item;

  const handleIncrement = () => {
    updateQuantity(product._id, size, color, quantity + 1);
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      updateQuantity(product._id, size, color, quantity - 1);
    } else {
      removeItem(product._id, size, color);
    }
  };

  const handleRemove = () => {
    removeItem(product._id, size, color);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex gap-3 rounded-xl border border-border bg-card p-3"
    >
      {/* Image — клик ведёт на страницу товара */}
      <Link
        href={`/product/${product.slug.current}`}
        className="relative block h-24 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-secondary"
      >
        {product.images?.[0] && (
          <Image
            src={product.images[0]}
            alt={product.title}
            fill
            className="object-cover"
          />
        )}
      </Link>

      {/* Info */}
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <Link
            href={`/product/${product.slug.current}`}
            className="block transition-opacity hover:opacity-80"
          >
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {typeof product.brand === 'string' ? product.brand : product.brand?.title}
            </p>
            <h3 className="text-sm font-medium text-foreground line-clamp-1">
              {product.title}
            </h3>
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ru.size}: {size}
            {color && ` • ${color}`}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-mono text-sm font-bold">
            {formatPrice(product.price * quantity)}
          </span>

          {/* Quantity Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleDecrement}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-secondary"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center font-mono text-sm">{quantity}</span>
            <button
              onClick={handleIncrement}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-secondary"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Remove Button */}
      <button
        onClick={handleRemove}
        className="self-start p-1 text-muted-foreground transition-colors hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
