"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Product } from "@shared/types";
import { formatPrice, cn } from "@shared/utils";

interface ProductCarouselProps {
  products: Product[];
  showSalePrice?: boolean;
  cardSize?: "default" | "large";
}

export function ProductCarousel({
  products,
  showSalePrice = false,
  cardSize = "default",
}: ProductCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -280 : 280;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  if (products.length === 0) return null;

  const isLarge = cardSize === "large";

  return (
    <div className="relative group">
      {/* Scroll Buttons (visible on hover) */}
      <button
        onClick={() => scroll("left")}
        className="absolute left-2 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={() => scroll("right")}
        className="absolute right-2 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Scrollable Container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-hide snap-x snap-mandatory"
      >
        {products.map((product, index) => (
          <motion.div
            key={product._id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="snap-start"
          >
            <Link
              href={`/product/${product.slug.current}`}
              className={cn(
                "block flex-shrink-0 overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-1",
                isLarge ? "w-[200px]" : "w-[160px]"
              )}
            >
              {/* Image */}
              <div
                className={cn(
                  "relative overflow-hidden bg-secondary",
                  isLarge ? "aspect-[3/4]" : "aspect-square"
                )}
              >
                {product.images?.[0] ? (
                  <Image
                    src={product.images[0]}
                    alt={product.title}
                    fill
                    className="object-cover transition-transform duration-500 hover:scale-105"
                    sizes={isLarge ? "200px" : "160px"}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    No Image
                  </div>
                )}

                {/* Brand Tag */}
                <div className="absolute left-2 top-2">
                  <span className="rounded-md bg-black/70 px-2 py-1 text-[9px] font-mono uppercase tracking-wider text-white/80 backdrop-blur-sm">
                    {typeof product.brand === 'string' ? product.brand : product.brand?.title}
                  </span>
                </div>

                {/* Sale Badge */}
                {product.isOnSale && (
                  <div className="absolute right-2 top-2">
                    <span className="rounded-md bg-red-600 px-2 py-1 text-[9px] font-bold uppercase text-white">
                      SALE
                    </span>
                  </div>
                )}

                {/* Hot Drop Badge */}
                {product.isHotDrop && !product.isOnSale && (
                  <div className="absolute right-2 top-2">
                    <span className="rounded-md bg-orange-600 px-2 py-1 text-[9px] font-bold uppercase text-white">
                      🔥 HOT
                    </span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <h3 className="truncate text-xs font-medium text-foreground">
                  {product.title}
                </h3>
                <div className="mt-1 flex items-center gap-2">
                  {(showSalePrice || product.isOnSale) && product.originalPrice != null ? (
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
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
