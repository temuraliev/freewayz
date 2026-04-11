"use client";

import { useCallback } from "react";
import { Product } from "@shared/types";
import { ProductCard } from "@frontend/components/products/product-card";
import { useInfiniteScroll, PAGE_SIZE } from "./use-infinite-scroll";
import { ru } from "@shared/i18n/ru";

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
  const fetchPage = useCallback(
    async (offset: number) => {
      const params = new URLSearchParams();
      if (filterParams.style) params.set("style", filterParams.style);
      if (filterParams.brand) params.set("brand", filterParams.brand);
      if (filterParams.category) params.set("category", filterParams.category);
      if (filterParams.subtype) params.set("subtype", filterParams.subtype);
      if (filterParams.saleOnly) params.set("saleOnly", "true");
      if (filterParams.minPrice > 0) params.set("minPrice", String(filterParams.minPrice));
      if (filterParams.maxPrice < 999_999_999) params.set("maxPrice", String(filterParams.maxPrice));
      params.set("offset", String(offset));
      params.set("limit", String(PAGE_SIZE));

      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      return (data.products ?? []) as Product[];
    },
    [filterParams]
  );

  const { items: products, loading, hasMore, sentinelRef } = useInfiniteScroll<Product>({
    initialItems: initialProducts,
    fetchPage,
  });

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
