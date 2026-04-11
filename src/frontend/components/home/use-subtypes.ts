"use client";

import { useEffect, useState } from "react";
import { useFilterStore, useAdminStore } from "@frontend/stores";

export function useSubtypes() {
  const [subtypes, setSubtypes] = useState<string[]>([]);

  const { style, brand, category, saleOnly, hasActiveFilters, minPrice, maxPrice } = useFilterStore();
  const catalogInvalidated = useAdminStore((s) => s.catalogInvalidated);
  const filtersActive = hasActiveFilters();

  useEffect(() => {
    if (!filtersActive) {
      setSubtypes([]);
      return;
    }

    const fetchSubtypes = async () => {
      try {
        const params = new URLSearchParams();
        if (saleOnly) params.set("saleOnly", "true");
        if (style) params.set("style", style);
        if (brand) params.set("brand", brand);
        if (category) params.set("category", category);
        if (minPrice != null && minPrice > 0) params.set("minPrice", String(minPrice));
        if (maxPrice != null && maxPrice < 999_999_999) params.set("maxPrice", String(maxPrice));

        const res = await fetch(`/api/products/subtypes?${params.toString()}`);
        const data = await res.json();
        setSubtypes(Array.isArray(data) ? data : []);
      } catch {
        setSubtypes([]);
      }
    };
    fetchSubtypes();
  }, [filtersActive, style, brand, category, saleOnly, minPrice, maxPrice, catalogInvalidated]);

  return subtypes;
}
