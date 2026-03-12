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
  // Default tier for SSR (until Next.js implements better cookie access in Server Components, 
  // we assume the default "ultimate" tier on initial server load)
  const defaultTier = "ultimate";

  let initialHotDrops = [];
  let initialSaleProducts = [];
  let initialFreshArrivals = [];

  try {
    // Fetch initial data on the server!
    [initialHotDrops, initialSaleProducts, initialFreshArrivals] = await Promise.all([
      client.fetch(hotDropsQuery, { tier: defaultTier }),
      client.fetch(saleProductsQuery, { tier: defaultTier }),
      client.fetch(freshArrivalsQuery, { tier: defaultTier }),
    ]);

    // Ensure they are arrays
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
