import { MetadataRoute } from "next";
import { client } from "@shared/sanity/client";

/**
 * Dynamic sitemap for all product pages + static pages.
 * Google/Yandex will discover all 15,000+ products for indexing.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://freewayz.uz";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/cart`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/recommendations`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];

  // Dynamic product pages
  let productPages: MetadataRoute.Sitemap = [];
  try {
    const products = await client.fetch<
      { slug: { current: string }; _updatedAt: string }[]
    >(`*[_type == "product"]{ slug, _updatedAt } | order(_updatedAt desc)`);

    productPages = products
      .filter((p) => p.slug?.current)
      .map((p) => ({
        url: `${baseUrl}/product/${p.slug.current}`,
        lastModified: new Date(p._updatedAt),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));
  } catch (error) {
    console.error("Sitemap: failed to fetch products", error);
  }

  return [...staticPages, ...productPages];
}
