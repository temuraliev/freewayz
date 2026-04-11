import { ProductPageClient } from "./product-page-client";
import { client } from "@/lib/sanity/client";
import { productBySlugQuery } from "@/lib/sanity/queries";
import { Product } from "@/lib/types";
import { notFound } from "next/navigation";
import { Metadata } from "next";

/** Ensures product has safe shape for client (no null refs in arrays, slug always object). */
function normalizeProduct(p: Product): Product {
  return {
    ...p,
    slug: p.slug && typeof p.slug === "object" && typeof (p.slug as { current?: string }).current === "string"
      ? { current: (p.slug as { current: string }).current }
      : { current: "" },
    images: Array.isArray(p.images) ? p.images.filter((url): url is string => typeof url === "string" && url.length > 0) : [],
    videos: Array.isArray(p.videos) ? p.videos.filter((url): url is string => typeof url === "string" && url.length > 0) : [],
    sizes: Array.isArray(p.sizes) ? p.sizes : [],
    colors: Array.isArray(p.colors) ? p.colors : [],
  };
}

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ edit?: string }>;
};

export const revalidate = 60; // Revalidate every 60 seconds

export async function generateStaticParams() {
  try {
    const products = await client.fetch<{ slug: { current: string } }[]>(
      `*[_type == "product"]{ slug }`
    );
    return products
      .filter((p) => p.slug?.current)
      .map((p) => ({
        slug: p.slug.current,
      }));
  } catch (error) {
    console.warn("generateStaticParams: failed to fetch products from Sanity. Skipping pre-render:", error);
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { slug } = await params;
    const product = await client.fetch<Product | null>(productBySlugQuery, { slug });
    if (!product) return { title: "Товар не найден | FreeWayz" };

    const safe = normalizeProduct(product);
    const brandName = typeof safe.brand === "string" ? safe.brand : safe.brand?.title || "";
    const title = `${brandName} ${safe.title} | FreeWayz`.trim();
    const firstImage = Array.isArray(safe.images) && safe.images.length > 0 && typeof safe.images[0] === "string" ? safe.images[0] : undefined;

    return {
      title,
      description: safe.description?.substring(0, 160),
      openGraph: firstImage ? { images: [firstImage] } : undefined,
    };
  } catch {
    return { title: "Товар | FreeWayz" };
  }
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
    return notFound();
  }

  const safeProduct = normalizeProduct(product);
  return <ProductPageClient product={safeProduct} initialEditMode={editMode} />;
}
