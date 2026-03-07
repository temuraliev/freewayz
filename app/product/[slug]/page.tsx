import { ProductPageClient } from "./product-page-client";
import { client } from "@/lib/sanity/client";
import { productBySlugQuery } from "@/lib/sanity/queries";
import { Product } from "@/lib/types";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { MOCK_PRODUCT } from "@/lib/mock-data";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ edit?: string }>;
};

export const revalidate = 60; // Revalidate every 60 seconds

export async function generateStaticParams() {
  const products = await client.fetch<{ slug: { current: string } }[]>(
    `*[_type == "product"]{ slug }`
  );
  return products
    .filter((p) => p.slug?.current)
    .map((p) => ({
      slug: p.slug.current,
    }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await client.fetch<Product | null>(productBySlugQuery, { slug });

  if (!product) {
    return { title: "Товар не найден | FreeWayz" };
  }

  const brandName = typeof product.brand === "string" ? product.brand : product.brand?.title || "";
  const title = `${brandName} ${product.title} | FreeWayz`.trim();

  return {
    title,
    description: product.description?.substring(0, 160),
    openGraph: {
      images: product.images?.[0] ? [product.images[0]] : [],
    },
  };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const editMode = sp?.edit === "1";

  let product: Product | null = null;
  try {
    product = await client.fetch<Product | null>(productBySlugQuery, { slug });
  } catch (error) {
    console.error("Sanity fetch failed:", error);
  }

  if (!product) {
    // Allow mock fallback in dev environment
    if (MOCK_PRODUCT.slug.current === slug) {
      product = MOCK_PRODUCT;
    } else {
      return notFound();
    }
  }

  return <ProductPageClient product={product} initialEditMode={editMode} />;
}
