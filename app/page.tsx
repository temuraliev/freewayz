import { findHotDrops, findSale, findFreshArrivals } from "@backend/repositories/product-repository";
import { HomeClient } from "@frontend/components/home/home-client";
import { Product } from "@shared/types";

// Enable caching (ISR) - revalidate every 60 seconds
export const revalidate = 60;

export default async function HomePage() {
  let initialHotDrops: Product[] = [];
  let initialSaleProducts: Product[] = [];
  let initialFreshArrivals: Product[] = [];

  try {
    [initialHotDrops, initialSaleProducts, initialFreshArrivals] = await Promise.all([
      findHotDrops(0, 20) as Promise<Product[]>,
      findSale(0, 20) as Promise<Product[]>,
      findFreshArrivals(0, 20) as Promise<Product[]>,
    ]);
  } catch (error) {
    console.error("DB fetch error:", error);
    if (process.env.NODE_ENV !== "production") {
      const { MOCK_PRODUCTS } = await import("@frontend/lib/mock-data");
      initialHotDrops = MOCK_PRODUCTS.filter((p) => p.isHotDrop && !p.isOnSale);
      initialSaleProducts = MOCK_PRODUCTS.filter((p) => p.isOnSale);
      initialFreshArrivals = MOCK_PRODUCTS;
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
