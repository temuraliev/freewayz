"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Product } from "@/lib/types";
import { ProductCard } from "@/components/products/product-card";
import { client } from "@/lib/sanity/client";
import { productsByFilterPaginatedQuery } from "@/lib/sanity/queries";
import { useTierStore } from "@/lib/store";
import { ru } from "@/lib/i18n/ru";

const PAGE_SIZE = 20;

interface FilterParams {
  saleOnly: boolean;
  style: string;
  brand: string;
  category: string;
  subtype: string;
  minPrice: number;
  maxPrice: number;
}

interface InfiniteFilterGridProps {
  initialProducts: Product[];
  filterParams: FilterParams;
  totalCount: number;
}

export function InfiniteFilterGrid({
  initialProducts,
  filterParams,
  totalCount,
}: InfiniteFilterGridProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialProducts.length >= PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(initialProducts.length);
  const tier = useTierStore((s) => s.tier);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const offset = offsetRef.current;
      const newItems = await client.fetch<Product[]>(productsByFilterPaginatedQuery, {
        offset,
        limit: offset + PAGE_SIZE,
        tier,
        ...filterParams,
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
  }, [loading, hasMore, tier, filterParams]);

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

  // Reset when filter changes
  useEffect(() => {
    setProducts(initialProducts);
    offsetRef.current = initialProducts.length;
    setHasMore(initialProducts.length >= PAGE_SIZE);
  }, [initialProducts]);

  return (
    <div>
      {totalCount > 0 && (
        <p className="px-4 pb-3 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          {ru.found ?? "Найдено"}: <span className="text-foreground font-bold">{totalCount}</span>
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 px-4">
        {products.map((product, i) => (
          <ProductCard key={product._id} product={product} index={i} />
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
