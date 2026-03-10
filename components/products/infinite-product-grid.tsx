"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Product } from "@/lib/types";
import { ProductCard } from "@/components/products/product-card";
import { client } from "@/lib/sanity/client";
import { useTierStore } from "@/lib/store";
import { ru } from "@/lib/i18n/ru";

const PAGE_SIZE = 20;

interface InfiniteProductGridProps {
    initialProducts: Product[];
    query: string; // paginated GROQ query accepting $offset and $limit
}

export function InfiniteProductGrid({ initialProducts, query }: InfiniteProductGridProps) {
    const [products, setProducts] = useState<Product[]>(initialProducts);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(initialProducts.length === PAGE_SIZE);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const offsetRef = useRef(initialProducts.length);
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
            (entries) => {
                if (entries[0].isIntersecting) loadMore();
            },
            { rootMargin: "200px" }
        );
        observer.observe(sentinelRef.current);
        return () => observer.disconnect();
    }, [loadMore]);

    // Reset when initial products change (e.g. filter changes)
    useEffect(() => {
        setProducts(initialProducts);
        offsetRef.current = initialProducts.length;
        setHasMore(initialProducts.length === PAGE_SIZE);
    }, [initialProducts]);

    return (
        <div>
            <div className="grid grid-cols-2 gap-3 px-4">
                {products.map((product, i) => (
                    <ProductCard key={product._id} product={product} index={i} />
                ))}
            </div>

            {/* Sentinel / Load more indicator */}
            <div ref={sentinelRef} className="flex items-center justify-center py-8">
                {loading && (
                    <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
                        {ru.loading ?? "Загрузка..."}
                    </div>
                )}
                {!hasMore && products.length > 0 && (
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/40">
                        — {ru.allProductsLoaded ?? "Все товары загружены"} —
                    </p>
                )}
            </div>
        </div>
    );
}
