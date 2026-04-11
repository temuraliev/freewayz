"use client";

import { useEffect, useState } from "react";
import { Product } from "@shared/types";
import { useAdminStore } from "@frontend/stores";

interface CuratedSections {
  hotDrops: Product[];
  saleProducts: Product[];
  freshArrivals: Product[];
}

export function useCuratedSections(initial: CuratedSections) {
  const [hotDrops, setHotDrops] = useState<Product[]>(initial.hotDrops);
  const [saleProducts, setSaleProducts] = useState<Product[]>(initial.saleProducts);
  const [freshArrivals, setFreshArrivals] = useState<Product[]>(initial.freshArrivals);

  const catalogInvalidated = useAdminStore((s) => s.catalogInvalidated);

  useEffect(() => {
    if (catalogInvalidated === 0) return;

    const fetchProducts = async () => {
      try {
        const [hotData, saleData, freshData] = await Promise.all([
          fetch("/api/products/hot-drops?offset=0&limit=20").then((r) => r.json()),
          fetch("/api/products/sale?offset=0&limit=20").then((r) => r.json()),
          fetch("/api/products/fresh?offset=0&limit=20").then((r) => r.json()),
        ]);
        setHotDrops(hotData || []);
        setSaleProducts(saleData || []);
        setFreshArrivals(freshData || []);
      } catch (error) {
        console.log("Client fetch error:", error);
      }
    };
    fetchProducts();
  }, [catalogInvalidated]);

  return { hotDrops, saleProducts, freshArrivals };
}
