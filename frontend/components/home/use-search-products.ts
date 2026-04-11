"use client";

import { useEffect, useState } from "react";
import { Product } from "@shared/types";
import { client } from "@shared/sanity/client";
import { useFilterStore } from "@frontend/stores";
import { searchProductsQuery } from "@shared/sanity/queries";
import { buildSearchTerms } from "@frontend/lib/search-utils";

export function useSearchProducts() {
  const [searchProducts, setSearchProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const { searchQuery, saleOnly } = useFilterStore();
  const searchActive = searchQuery.length >= 2;

  useEffect(() => {
    if (!searchActive) {
      setSearchProducts([]);
      return;
    }

    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const searchTerms = buildSearchTerms(searchQuery);
        if (searchTerms.length === 0) {
          setSearchProducts([]);
          setLoading(false);
          return;
        }
        const data = await client.fetch(searchProductsQuery, { searchTerms });
        setSearchProducts(Array.isArray(data) ? data : []);
      } catch {
        setSearchProducts([]);
      }
      setLoading(false);
    }, 300);

    return () => clearTimeout(t);
  }, [searchQuery, searchActive]);

  // Apply sale filter to search results
  const displayProducts = saleOnly
    ? searchProducts.filter((p) => p.isOnSale)
    : searchProducts;

  return { searchProducts: displayProducts, searchActive, loading };
}
