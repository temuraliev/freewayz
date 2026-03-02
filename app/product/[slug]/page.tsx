import { client } from "@/lib/sanity/client";
import { productBySlugQuery } from "@/lib/sanity/queries";
import { ProductPageClient } from "./product-page-client";
import { Product } from "@/lib/types";

// ISR: revalidate every 60 seconds
export const revalidate = 60;

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;

  let product: Product | null = null;
  try {
    product = await client.fetch<Product | null>(productBySlugQuery, { slug });
  } catch (error) {
    console.error(`[ProductPage] Failed to fetch product "${slug}":`, error);
  }

  return <ProductPageClient slug={slug} initialProduct={product} />;
}
