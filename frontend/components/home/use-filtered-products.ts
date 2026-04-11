"use client";

import { useEffect, useMemo, useState } from "react";
import { Product } from "@shared/types";
import { useFilterStore, useAdminStore } from "@frontend/stores";

export function useFilteredProducts() {
  const [filteredProducts, setFilteredProducts] = useState<Product[] | null>(null);
  const [filteredCount, setFilteredCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const { style, brand, category, subtype, saleOnly, hasActiveFilters, minPrice, maxPrice } = useFilterStore();
  const catalogInvalidated = useAdminStore((s) => s.catalogInvalidated);
  const filtersActive = hasActiveFilters();

  const filterParams = useMemo(() => ({
    saleOnly: !!saleOnly,
    style: style || "",
    brand: brand || "",
    category: category || "",
    subtype: subtype || "",
    minPrice: minPrice ?? 0,
    maxPrice: maxPrice ?? 999_999_999,
  }), [saleOnly, style, brand, category, subtype, minPrice, maxPrice]);

  useEffect(() => {
    if (!filtersActive) {
      setFilteredProducts(null);
      setFilteredCount(0);
      return;
    }

    const fetchFiltered = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filterParams.style) params.set("style", filterParams.style);
        if (filterParams.brand) params.set("brand", filterParams.brand);
        if (filterParams.category) params.set("category", filterParams.category);
        if (filterParams.subtype) params.set("subtype", filterParams.subtype);
        if (filterParams.saleOnly) params.set("saleOnly", "true");
        if (filterParams.minPrice > 0) params.set("minPrice", String(filterParams.minPrice));
        if (filterParams.maxPrice < 999_999_999) params.set("maxPrice", String(filterParams.maxPrice));
        params.set("limit", "20");

        const res = await fetch(`/api/products?${params.toString()}`);
        const data = await res.json();
        setFilteredProducts(Array.isArray(data.products) ? data.products : []);
        setFilteredCount(typeof data.total === "number" ? data.total : 0);
      } catch (error) {
        console.log("Filter error:", error);
        setFilteredProducts([]);
        setFilteredCount(0);
      }
      setLoading(false);
    };

    fetchFiltered();
  }, [style, brand, category, subtype, saleOnly, filtersActive, catalogInvalidated, filterParams]);

  return { filteredProducts, filteredCount, loading, filterParams, filtersActive };
}
