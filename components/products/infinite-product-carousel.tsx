"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Product } from "@/lib/types";
import { formatPrice, cn } from "@/lib/utils";
import { client } from "@/lib/sanity/client";
import { useTierStore } from "@/lib/store";
import { AdminEditButton } from "@/components/admin/admin-edit-button";

const PAGE_SIZE = 20;

interface InfiniteProductCarouselProps {
    initialProducts: Product[];
    query: string; // paginated GROQ: $offset, $limit
    cardSize?: "default" | "large";
    showSalePrice?: boolean;
}

export function InfiniteProductCarousel({
    initialProducts,
    query,
    cardSize = "large",
    showSalePrice = false,
}: InfiniteProductCarouselProps) {
    const [products, setProducts] = useState<Product[]>(initialProducts);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(initialProducts.length === PAGE_SIZE);
    const offsetRef = useRef(initialProducts.length);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const isLarge = cardSize === "large";
    const tier = useTierStore((s) => s.tier);

    const loadMore = useCallback(async () => {
        if (loading || !hasMore) return;
        setLoading(true);
        try {
            const offset = offsetRef.current;
            const newItems = await client.fetch<Product[]>(query, {
                offset,
                limit: offset + PAGE_SIZE,
                tier,
            });
            if (!Array.isArray(newItems) || newItems.length === 0) {
                setHasMore(false);
            } else {
                setProducts((prev) => [...prev, ...newItems]);
                offsetRef.current = offset + newItems.length;
                if (newItems.length < PAGE_SIZE) setHasMore(false);
            }
        } catch {
            setHasMore(false);
        }
        setLoading(false);
    }, [loading, hasMore, query, tier]);

    useEffect(() => {
        if (!sentinelRef.current) return;
        const observer = new IntersectionObserver(
            (entries) => { if (entries[0].isIntersecting) loadMore(); },
            { root: sentinelRef.current?.closest(".carousel-scroll") ?? null, rootMargin: "0px 120px 0px 0px" }
        );
        observer.observe(sentinelRef.current);
        return () => observer.disconnect();
    }, [loadMore]);

    useEffect(() => {
        setProducts(initialProducts);
        offsetRef.current = initialProducts.length;
        setHasMore(initialProducts.length === PAGE_SIZE);
    }, [initialProducts]);

    if (products.length === 0) return null;

    return (
        <div className="relative">
            {/* Horizontal scroll container */}
            <div className="carousel-scroll flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-hide snap-x snap-mandatory">
                {products.map((product, index) => (
                    <motion.div
                        key={product._id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: Math.min(index, 5) * 0.05 }}
                        className="snap-start flex-shrink-0"
                    >
                        <Link
                            href={`/product/${product.slug.current}`}
                            className={cn(
                                "block overflow-hidden border border-border bg-card transition-all hover:-translate-y-1",
                                isLarge ? "w-[190px]" : "w-[160px]"
                            )}
                            style={{ borderRadius: "2px" }}
                        >
                            {/* Image */}
                            <div
                                className={cn(
                                    "relative overflow-hidden bg-secondary",
                                    isLarge ? "aspect-[3/4]" : "aspect-square"
                                )}
                            >
                                <AdminEditButton product={product} className="left-2 top-2 right-auto" />
                                {product.images?.[0] ? (
                                    <Image
                                        src={product.images[0]}
                                        alt={product.title}
                                        fill
                                        className="object-cover transition-transform duration-500 hover:scale-105"
                                        sizes={isLarge ? "190px" : "160px"}
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                                        No Image
                                    </div>
                                )}

                                {/* Badges */}
                                {product.isOnSale && (
                                    <div className="absolute right-2 top-2">
                                        <span className="bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">SALE</span>
                                    </div>
                                )}
                                {product.isHotDrop && !product.isOnSale && (
                                    <div className="absolute right-2 top-2">
                                        <span className="bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">HOT</span>
                                    </div>
                                )}
                                {product.isNewArrival && !product.isOnSale && !product.isHotDrop && (
                                    <div className="absolute right-2 top-2">
                                        <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase text-white" style={{ background: '#0ea5e9' }}>NEW</span>
                                    </div>
                                )}

                                {/* Info */}
                            </div>
                            <div className="p-2.5">
                                <h3 className="truncate text-[11px] font-semibold uppercase tracking-tight text-foreground">
                                    {product.title}
                                </h3>
                                <div className="mt-1">
                                    {(showSalePrice || product.isOnSale) && product.originalPrice != null ? (
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="font-mono text-sm font-bold text-red-500">{formatPrice(product.price)}</span>
                                            <span className="font-mono text-[10px] text-muted-foreground line-through">{formatPrice(product.originalPrice)}</span>
                                        </div>
                                    ) : (
                                        <span className="font-mono text-sm font-bold text-foreground">{formatPrice(product.price)}</span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                ))}

                {/* Sentinel — visible at right edge, triggers load */}
                <div ref={sentinelRef} className="flex flex-shrink-0 items-center justify-center px-2">
                    {loading && (
                        <div className="flex flex-col items-center gap-2">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
                        </div>
                    )}
                    {!hasMore && products.length > 0 && (
                        <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/40 [writing-mode:vertical-rl]">
                            ✓ END
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
