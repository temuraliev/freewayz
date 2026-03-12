"use client";

import { Pencil } from "lucide-react";
import { useAdminStore } from "@/lib/store";
import { Product } from "@/lib/types";

interface AdminEditButtonProps {
  product: Product;
  className?: string;
}

export function AdminEditButton({ product, className = "" }: AdminEditButtonProps) {
  const isAdmin = useAdminStore((s) => s.isAdmin);
  const setEditingProduct = useAdminStore((s) => s.setEditingProduct);

  if (isAdmin !== true) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingProduct(product);
      }}
      className={`absolute left-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80 ${className}`}
      aria-label="Редактировать товар"
    >
      <Pencil className="h-4 w-4" />
    </button>
  );
}
