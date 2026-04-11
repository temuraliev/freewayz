import { client } from "@/lib/sanity/client";
import {
  hotDropsQuery,
  saleProductsQuery,
  freshArrivalsQuery,
} from "@/lib/sanity/queries";
import { HomeClient } from "@/components/home/home-client";

// Enable caching (ISR) - revalidate every 60 seconds
export const revalidate = 60;

export default async function HomePage() {
  let initialHotDrops = [];
  let initialSaleProducts = [];
  let initialFreshArrivals = [];

  try {
    [initialHotDrops, initialSaleProducts, initialFreshArrivals] = await Promise.all([
      client.fetch(hotDropsQuery),
      client.fetch(saleProductsQuery),
      client.fetch(freshArrivalsQuery),
    ]);

    initialHotDrops = initialHotDrops || [];
    initialSaleProducts = initialSaleProducts || [];
    initialFreshArrivals = initialFreshArrivals || [];
  } catch (error) {
    console.error("Sanity fetch error:", error);
    initialHotDrops = [];
    initialSaleProducts = [];
    initialFreshArrivals = [];
  }

  return (
    <HomeClient
      initialHotDrops={initialHotDrops}
      initialSaleProducts={initialSaleProducts}
      initialFreshArrivals={initialFreshArrivals}
    />
  );
}
