"use client";

import { useEffect, useState } from "react";
import { client } from "@shared/sanity/client";
import { useFilterStore, useAdminStore } from "@frontend/stores";
import { distinctSubtypesQuery } from "@shared/sanity/queries";

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
        const data = await client.fetch(distinctSubtypesQuery, {
          saleOnly: !!saleOnly,
          style: style || "",
          brand: brand || "",
          category: category || "",
          minPrice: minPrice ?? 0,
          maxPrice: maxPrice ?? 999_999_999,
        });
        const raw = Array.isArray(data) ? data : [];
        const subtypeCounts = new Map<string, number>();
        for (const p of raw) {
          const st = (p as { subtype?: string | null }).subtype;
          if (st && typeof st === "string")
            subtypeCounts.set(st, (subtypeCounts.get(st) ?? 0) + 1);
        }
        const sorted = [...subtypeCounts.keys()].sort(
          (a, b) => (subtypeCounts.get(b) ?? 0) - (subtypeCounts.get(a) ?? 0)
        );
        setSubtypes(sorted);
      } catch {
        setSubtypes([]);
      }
    };
    fetchSubtypes();
  }, [filtersActive, style, brand, category, saleOnly, minPrice, maxPrice, catalogInvalidated]);

  return subtypes;
}
