"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Product } from "@/lib/types";
import { formatPrice, optimizeImage } from "@/lib/utils";
import { useTierStore, useQuickViewStore, useWishlistStore, useCartStore } from "@/lib/store";
import { ru } from "@/lib/i18n/ru";
import { AdminEditButton } from "@/components/admin/admin-edit-button";
import { Heart } from "lucide-react";
import { ymTrack } from "@/components/providers/yandex-metrica";
import { useState } from "react";

interface ProductCardProps {
  product: Product;
  index?: number;
}

export function ProductCard({ product, index = 0 }: ProductCardProps) {
  const brandName = typeof product.brand === "string" ? product.brand : product.brand?.title;
  const styleName = typeof product.style === "string" ? product.style : product.style?.title;
  const tier = useTierStore((s) => s.tier);
  const isUlt = tier === "ultimate";
  const openQuickView = useQuickViewStore((s) => s.openQuickView);
  const { isInWishlist, toggleItem } = useWishlistStore();
  const isLiked = isInWishlist(product._id);
  const { addItem } = useCartStore();
  const [added, setAdded] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    openQuickView(product);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleItem(product);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <a href={`/product/${product.slug.current}`} onClick={handleClick} className="group block relative cursor-pointer">
        <div className="product-card-editorial">
          {/* Image */}
          <div className="card-img-wrap">
            <AdminEditButton product={product} />
            <button
              onClick={handleLike}
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/50 backdrop-blur-md transition-colors hover:bg-background/80"
              aria-label={isLiked ? "Remove from wishlist" : "Add to wishlist"}
            >
              <Heart
                className={`h-4 w-4 transition-colors ${
                  isLiked ? "fill-red-500 text-red-500" : "text-foreground"
                }`}
              />
            </button>
            {product.images?.[0] ? (
              <Image
                src={optimizeImage(product.images[0], 400)}
                alt={product.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 33vw"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                {ru.noImage}
              </div>
            )}

            {/* Badges */}
            {product.isOnSale && <span className="badge-sale">{ru.sale}</span>}
            {product.isHotDrop && !product.isOnSale && (
              <span className="badge-hot">HOT</span>
            )}
            {product.isNewArrival && !product.isOnSale && !product.isHotDrop && (
              <span className="badge-new">NEW</span>
            )}
          </div>

          {/* Info */}
          <div className="card-info">
            <h3 className="truncate text-[13px] font-semibold leading-tight text-foreground">
              {product.title}
            </h3>

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                {product.isOnSale && product.originalPrice != null ? (
                  <>
                    <span className={`font-mono text-[13px] font-bold ${isUlt ? "text-amber-500" : "text-red-500"}`}>
                      {formatPrice(product.price)}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground line-through">
                      {formatPrice(product.originalPrice)}
                    </span>
                  </>
                ) : (
                  <span className="font-mono text-[13px] font-bold text-foreground">
                    {formatPrice(product.price)}
                  </span>
                )}
              </div>
              {styleName && (
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 font-mono">
                  {styleName}
                </span>
              )}
            </div>
          </div>
        </div>
      </a>
    </motion.div>
  );
}
