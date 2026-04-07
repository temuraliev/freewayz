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
    console.log("Server fetch error, falling back to mock data:", error);
    initialHotDrops = MOCK_PRODUCTS.filter((p) => p.isHotDrop && !p.isOnSale);
    initialSaleProducts = MOCK_PRODUCTS.filter((p) => p.isOnSale);
    initialFreshArrivals = MOCK_PRODUCTS;
  }

  return (
    <HomeClient
      initialHotDrops={initialHotDrops}
      initialSaleProducts={initialSaleProducts}
      initialFreshArrivals={initialFreshArrivals}
    />
  );
}
