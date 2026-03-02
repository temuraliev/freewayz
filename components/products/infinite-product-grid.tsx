"use client";

import { useEffect, useRef, useState, useCallback, memo } from "react";
import { Product } from "@/lib/types";
import { ProductCard } from "./product-card";
import { Loader2 } from "lucide-react";
import { ru } from "@/lib/i18n/ru";

const PAGE_SIZE = 20;

const MemoizedProductCard = memo(ProductCard);

interface InfiniteProductGridProps {
    /** Initial products (first page, already loaded) */
    products: Product[];
    /** Total count of products matching the filter (for "X of Y" display) */
    totalCount?: number;
}

export function InfiniteProductGrid({
    products,
    totalCount,
}: InfiniteProductGridProps) {
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Reset when products change (e.g. filter change)
    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [products]);

    const loadMore = useCallback(() => {
        if (visibleCount >= products.length) return;
        setIsLoadingMore(true);
        // Small delay to show loading indicator and avoid jank
        requestAnimationFrame(() => {
            setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, products.length));
            setIsLoadingMore(false);
        });
    }, [visibleCount, products.length]);

    // IntersectionObserver for auto-load
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadMore();
                }
            },
            { rootMargin: "400px" } // pre-load 400px before reaching the end
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [loadMore]);

    if (products.length === 0) {
        return (
            <div className="flex min-h-[200px] flex-col items-center justify-center text-center">
                <p className="text-lg font-medium text-muted-foreground">
                    {ru.searchNoResults}
                </p>
            </div>
        );
    }

    const visible = products.slice(0, visibleCount);
    const hasMore = visibleCount < products.length;

    return (
        <div>
            <div className="grid grid-cols-2 gap-3 px-4">
                {visible.map((product, index) => (
                    <MemoizedProductCard
                        key={product._id}
                        product={product}
                        index={index < PAGE_SIZE ? index : 0} // only animate first page
                    />
                ))}
            </div>

            {/* Status bar */}
            {totalCount != null && totalCount > PAGE_SIZE && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                    {ru.showing} {Math.min(visibleCount, products.length)} {ru.of} {totalCount}
                </p>
            )}

            {/* Sentinel for IntersectionObserver */}
            {hasMore && (
                <div ref={sentinelRef} className="flex justify-center py-6">
                    {isLoadingMore && (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    )}
                </div>
            )}
        </div>
    );
}
