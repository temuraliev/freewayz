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
  const brandName = typeof product.brand === "string" ? product.brand : product.brand?.title;
  const styleName = typeof product.style === "string" ? product.style : product.style?.title;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={`/product/${product.slug.current}`} className="group block">
        <div className="product-card-editorial">
          {/* Image */}
          <div className="card-img-wrap">
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
            {/* Product name */}
            <h3 className="truncate text-[13px] font-semibold leading-tight text-foreground">
              {product.title}
            </h3>

            {/* Price row */}
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                {product.isOnSale && product.originalPrice != null ? (
                  <>
                    <span className="font-mono text-[13px] font-bold text-red-500">
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
      </Link>
    </motion.div>
  );
}
