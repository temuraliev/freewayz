"use client";

import { useEffect, useState } from "react";
import { Product } from "@/lib/types";
import { client } from "@/lib/sanity/client";
import { relatedProductsQuery } from "@/lib/sanity/queries";
import { ProductCard } from "@/components/products/product-card";
import { useTierStore } from "@/lib/store";
import { SectionHeader } from "@/components/products/section-header";
import { ru } from "@/lib/i18n/ru";

interface RelatedProductsProps {
  currentProductId: string;
  brandId?: string;
  styleId?: string;
  categoryId?: string;
}

export function RelatedProducts({ currentProductId, brandId, styleId, categoryId }: RelatedProductsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const tier = useTierStore((s) => s.tier);

  useEffect(() => {
    async function fetchRelated() {
      if (!brandId && !styleId && !categoryId) {
        setLoading(false);
        return;
      }
      
      try {
        const data = await client.fetch(relatedProductsQuery, {
          currentProductId,
          brandId: brandId || "",
          styleId: styleId || "",
          categoryId: categoryId || "",
          tier
        });
        
        setProducts(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to fetch related products:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRelated();
  }, [currentProductId, brandId, styleId, categoryId, tier]);

  if (loading) {
    return (
      <div className="mt-8 pt-8 border-t border-border">
        <div className="px-4 mb-4">
          <div className="h-4 w-32 bg-secondary/50 animate-pulse rounded" />
        </div>
        <div className="flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-hide">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-[3/4] w-[140px] flex-shrink-0 animate-pulse bg-secondary/50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <div className="mt-4 pt-10 border-t border-border">
      <SectionHeader eyebrow="ALSO LIKE" title={ru.youMightAlsoLike || "Похожие товары"} />
      
      <div className="flex gap-3 overflow-x-auto px-4 pb-4 pt-2 scrollbar-hide snap-x">
        {products.map((product, i) => (
          <div key={product._id} className="w-[160px] flex-shrink-0 snap-start">
            <ProductCard product={product} index={i} />
          </div>
        ))}
      </div>
    </div>
  );
}
