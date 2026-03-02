import { client } from "@/lib/sanity/client";
import {
  hotDropsQuery,
  saleProductsQuery,
  freshArrivalsQuery,
} from "@/lib/sanity/queries";
import { HomeClient, HomeInitialData } from "./home-client";
import { Product } from "@/lib/types";

// ISR: revalidate every 60 seconds
export const revalidate = 60;

export default async function HomePage() {
  let initialData: HomeInitialData;

  try {
    const [hotDrops, saleProducts, freshArrivals] = await Promise.all([
      client.fetch<Product[]>(hotDropsQuery),
      client.fetch<Product[]>(saleProductsQuery),
      client.fetch<Product[]>(freshArrivalsQuery),
    ]);

    initialData = {
      hotDrops: hotDrops ?? [],
      saleProducts: saleProducts ?? [],
      freshArrivals: freshArrivals ?? [],
    };
  } catch (error) {
    console.error("[HomePage] Failed to fetch initial data:", error);
    initialData = {
      hotDrops: [],
      saleProducts: [],
      freshArrivals: [],
    };
  }

  return <HomeClient initialData={initialData} />;
}
