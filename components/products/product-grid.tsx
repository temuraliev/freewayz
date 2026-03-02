"use client";

import { Product } from "@/lib/types";
import { ProductCard } from "./product-card";

interface ProductGridProps {
  products: Product[];
}

export function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center text-center">
        <p className="text-lg font-medium text-muted-foreground">
          No products found
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try adjusting your filters
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 px-4">
      {products.map((product, index) => (
        <ProductCard key={product._id} product={product} index={index} />
      ))}
    </div>
  );
}
