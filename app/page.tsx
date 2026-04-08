import { client } from "@/lib/sanity/client";
import {
  hotDropsQuery,
  saleProductsQuery,
  freshArrivalsQuery,
} from "@/lib/sanity/queries";
import { HomeClient } from "@/components/home/home-client";
import { MOCK_PRODUCTS } from "@/lib/mock-data";

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
    if (process.env.NODE_ENV !== "production") {
      // Dev fallback: show mock data so you can work without a live Sanity connection
      initialHotDrops = MOCK_PRODUCTS.filter((p) => p.isHotDrop && !p.isOnSale);
      initialSaleProducts = MOCK_PRODUCTS.filter((p) => p.isOnSale);
      initialFreshArrivals = MOCK_PRODUCTS;
    } else {
      // In production, return empty arrays — the client will show a loading/empty state.
      // Do NOT serve stale mock data to real users.
      initialHotDrops = [];
      initialSaleProducts = [];
      initialFreshArrivals = [];
    }
  }

  return (
    <HomeClient
      initialHotDrops={initialHotDrops}
      initialSaleProducts={initialSaleProducts}
      initialFreshArrivals={initialFreshArrivals}
    />
  );
}
