"use client";

import { useEffect, useState } from "react";

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
      fetch("/api/catalog/brands").then((r) => r.json()),
      fetch("/api/catalog/categories").then((r) => r.json()),
      fetch("/api/catalog/styles").then((r) => r.json()),
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
