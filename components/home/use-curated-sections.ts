"use client";

import { useEffect, useState } from "react";
import { Product } from "@/lib/types";
import { client } from "@/lib/sanity/client";
import { useAdminStore, useTierStore } from "@/lib/store";
import {
  hotDropsPaginatedQuery,
  saleProductsPaginatedQuery,
  freshArrivalsPaginatedQuery,
} from "@/lib/sanity/queries";

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
  const tier = useTierStore((s) => s.tier);

  useEffect(() => {
    if (catalogInvalidated === 0 && tier === "ultimate") return;

    const fetchProducts = async () => {
      try {
        const params = { tier, offset: 0, limit: 20 };
        const [hotData, saleData, freshData] = await Promise.all([
          client.fetch<Product[]>(hotDropsPaginatedQuery, params),
          client.fetch<Product[]>(saleProductsPaginatedQuery, params),
          client.fetch<Product[]>(freshArrivalsPaginatedQuery, params),
        ]);
        setHotDrops(hotData || []);
        setSaleProducts(saleData || []);
        setFreshArrivals(freshData || []);
      } catch (error) {
        console.log("Client fetch error:", error);
      }
    };
    fetchProducts();
  }, [catalogInvalidated, tier]);

  return { hotDrops, saleProducts, freshArrivals };
}
