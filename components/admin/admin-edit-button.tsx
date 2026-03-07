"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { useAdminStore } from "@/lib/store";
import { Product } from "@/lib/types";

interface AdminEditButtonProps {
  product: Product;
  className?: string;
}

export function AdminEditButton({ product, className = "" }: AdminEditButtonProps) {
  const isAdmin = useAdminStore((s) => s.isAdmin);

  if (isAdmin !== true) return null;

  return (
    <Link
      href={`/product/${product.slug.current}?edit=1`}
      className={`absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80 ${className}`}
      onClick={(e) => e.stopPropagation()}
      aria-label="Edit product"
    >
      <Pencil className="h-4 w-4" />
    </Link>
  );
}
