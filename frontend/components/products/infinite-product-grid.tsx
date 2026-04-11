"use client";

import { useCallback } from "react";
import { Product } from "@shared/types";
import { ProductCard } from "@frontend/components/products/product-card";
import { client } from "@shared/sanity/client";
import { useInfiniteScroll, PAGE_SIZE } from "./use-infinite-scroll";
import { ru } from "@shared/i18n/ru";

interface InfiniteProductGridProps {
    initialProducts: Product[];
    query: string;
}

export function InfiniteProductGrid({ initialProducts, query }: InfiniteProductGridProps) {
    const fetchPage = useCallback(
        async (offset: number) =>
            client.fetch<Product[]>(query, { offset, limit: offset + PAGE_SIZE }),
        [query]
    );

    const { items: products, loading, hasMore, sentinelRef } = useInfiniteScroll<Product>({
        initialItems: initialProducts,
        fetchPage,
    });

    return (
        <div>
            <div className="grid grid-cols-2 gap-3 px-4">
                {products.map((product, i) => (
                    <ProductCard
                        key={product._id}
                        product={product}
                        index={i}
                        priority={i < 2}
                    />
                ))}
            </div>

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
