"use client";

import { useEffect, useState } from "react";
import { client } from "@shared/sanity/client";
import { brandsQuery, categoriesQuery, stylesQuery } from "@shared/sanity/queries";

export interface CatalogRef {
  _id: string;
  title: string;
  slug: { current: string };
}

export interface CategoryRef extends CatalogRef {
  subtypes?: string[];
}

export function useCatalogRefs(enabled: boolean) {
  const [brands, setBrands] = useState<CatalogRef[]>([]);
  const [categories, setCategories] = useState<CategoryRef[]>([]);
  const [styles, setStyles] = useState<CatalogRef[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    Promise.all([
      client.fetch<CatalogRef[]>(brandsQuery),
      client.fetch<CategoryRef[]>(categoriesQuery),
      client.fetch<CatalogRef[]>(stylesQuery),
    ]).then(([b, c, s]) => {
      if (cancelled) return;
      setBrands(b ?? []);
      setCategories(c ?? []);
      setStyles(s ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { brands, categories, styles };
}
