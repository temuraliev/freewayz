"use client";

import { useEffect, useState } from "react";
import { client } from "@shared/sanity/client";
import { brandsQuery, categoriesQuery, stylesQuery } from "@shared/sanity/queries";
import { Brand, Category, Style } from "@shared/types";

const FALLBACK_CATEGORIES: Category[] = [
  { _id: "1", title: "Hoodies", slug: { current: "hoodies" }, image: null },
  { _id: "2", title: "T-Shirts", slug: { current: "t-shirts" }, image: null },
  { _id: "3", title: "Pants", slug: { current: "pants" }, image: null },
  { _id: "4", title: "Outerwear", slug: { current: "outerwear" }, image: null },
  { _id: "5", title: "Footwear", slug: { current: "footwear" }, image: null },
  { _id: "6", title: "Accessories", slug: { current: "accessories" }, image: null },
];

/**
 * Fetches categories, styles, and brands from Sanity for filter UI.
 * Falls back to hardcoded categories if Sanity is unreachable.
 */
export function useFilterData() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [catData, styleData, brandData] = await Promise.all([
          client.fetch<Category[]>(categoriesQuery),
          client.fetch<Style[]>(stylesQuery),
          client.fetch<Brand[]>(brandsQuery),
        ]);
        if (cancelled) return;
        setCategories(Array.isArray(catData) && catData.length > 0 ? catData : FALLBACK_CATEGORIES);
        if (Array.isArray(styleData)) setStyles(styleData);
        if (Array.isArray(brandData)) setBrands(brandData);
      } catch {
        if (!cancelled) setCategories(FALLBACK_CATEGORIES);
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, styles, brands };
}
