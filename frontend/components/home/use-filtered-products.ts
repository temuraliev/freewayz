"use client";

import { useEffect, useMemo, useState } from "react";
import { Product } from "@shared/types";
import { client } from "@shared/sanity/client";
import { useFilterStore, useAdminStore } from "@frontend/stores";
import {
  productsByFilterQuery,
  productsByFilterCountQuery,
} from "@shared/sanity/queries";

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
        const [data, count] = await Promise.all([
          client.fetch(productsByFilterQuery, filterParams),
          client.fetch(productsByFilterCountQuery, filterParams),
        ]);
        setFilteredProducts(Array.isArray(data) ? data : []);
        setFilteredCount(typeof count === "number" ? count : 0);
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
