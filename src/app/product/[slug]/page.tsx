import { ProductPageClient } from "./product-page-client";
import { findBySlug, findAllSlugs } from "@backend/repositories/product-repository";
import { Product } from "@shared/types";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { MOCK_PRODUCT } from "@frontend/lib/mock-data";

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
    const slugs = await findAllSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch (error) {
    console.warn("generateStaticParams: failed to fetch products. Skipping pre-render:", error);
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { slug } = await params;
    const product = await findBySlug(slug) as Product | null;
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
    product = await findBySlug(slug) as Product | null;
  } catch (error) {
    console.error("DB fetch failed:", error);
  }

  if (!product) {
    if (MOCK_PRODUCT.slug.current === slug) {
      product = MOCK_PRODUCT;
    } else {
      return notFound();
    }
  }

  const safeProduct = normalizeProduct(product);
  return <ProductPageClient product={safeProduct} initialEditMode={editMode} />;
}
