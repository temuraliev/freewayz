"use client";

import { useEffect, useState } from "react";
import { Product } from "@shared/types";
import { client } from "@shared/sanity/client";
import { useAdminStore } from "@frontend/stores";
import {
  hotDropsPaginatedQuery,
  saleProductsPaginatedQuery,
  freshArrivalsPaginatedQuery,
} from "@shared/sanity/queries";

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
        const params = { offset: 0, limit: 20 };
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
  }, [catalogInvalidated]);

  return { hotDrops, saleProducts, freshArrivals };
}
