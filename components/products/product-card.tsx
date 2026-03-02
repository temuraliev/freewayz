"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Product } from "@/lib/types";
import { formatPrice, optimizeImage } from "@/lib/utils";
import { ru } from "@/lib/i18n/ru";

interface ProductCardProps {
  product: Product;
  index?: number;
}

export function ProductCard({ product, index = 0 }: ProductCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link href={`/product/${product.slug.current}`} className="group block">
        <div className="product-card overflow-hidden rounded-xl border border-border bg-card">
          {/* Image Container */}
          <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
            {product.images?.[0] ? (
              <Image
                src={optimizeImage(product.images[0], 400)}
                alt={product.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 50vw, 33vw"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                {ru.noImage}
              </div>
            )}

            {/* Brand Tag */}
            <div className="absolute left-2 top-2">
              <span className="rounded-md bg-black/70 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-white/80 backdrop-blur-sm">
                {typeof product.brand === 'string' ? product.brand : product.brand?.title}
              </span>
            </div>

            {/* Sale Badge */}
            {product.isOnSale && (
              <div className="absolute right-2 top-2">
                <span className="rounded-md bg-red-600 px-2 py-1 text-[9px] font-bold uppercase text-white">
                  {ru.sale}
                </span>
              </div>
            )}

            {/* Hot Drop Badge */}
            {product.isHotDrop && !product.isOnSale && (
              <div className="absolute right-2 top-2">
                <span className="rounded-md bg-orange-600 px-2 py-1 text-[9px] font-bold uppercase text-white">
                  {ru.hot}
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-3">
            <h3 className="truncate text-sm font-medium text-foreground">
              {product.title}
            </h3>
            <div className="mt-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {product.isOnSale && product.originalPrice != null ? (
                  <>
                    <span className="font-mono text-sm font-bold text-red-500">
                      {formatPrice(product.price)}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground line-through">
                      {formatPrice(product.originalPrice)}
                    </span>
                  </>
                ) : (
                  <span className="font-mono text-sm font-bold text-foreground">
                    {formatPrice(product.price)}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {typeof product.style === 'string' ? product.style : product.style?.title}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
