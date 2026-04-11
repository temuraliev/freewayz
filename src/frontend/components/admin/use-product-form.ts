"use client";

import { useEffect, useState } from "react";
import { Product } from "@shared/types";

export interface ProductFormState {
  title: string;
  description: string;
  price: string;
  originalPrice: string;
  subtype: string;
  isHotDrop: boolean;
  isOnSale: boolean;
  isNewArrival: boolean;
  sizes: string[];
  colors: string[];
  brandId: string;
  categoryId: string;
  styleId: string;
}

function getBrandId(product: Product): string {
  return (product.brand && typeof product.brand !== "string" ? product.brand._id : "") ?? "";
}

function getStyleId(product: Product): string {
  return (product.style && typeof product.style !== "string" ? product.style._id : "") ?? "";
}

export function useProductForm(product: Product, open: boolean) {
  const [form, setForm] = useState<ProductFormState>(() => ({
    title: product.title,
    description: product.description ?? "",
    price: String(product.price),
    originalPrice: product.originalPrice != null ? String(product.originalPrice) : "",
    subtype: product.subtype ?? "",
    isHotDrop: !!product.isHotDrop,
    isOnSale: !!product.isOnSale,
    isNewArrival: !!product.isNewArrival,
    sizes: product.sizes ?? [],
    colors: product.colors ?? [],
    brandId: getBrandId(product),
    categoryId: "",
    styleId: getStyleId(product),
  }));

  // Reset when drawer opens with a different product
  useEffect(() => {
    if (!open) return;
    setForm({
      title: product.title,
      description: product.description ?? "",
      price: String(product.price),
      originalPrice: product.originalPrice != null ? String(product.originalPrice) : "",
      subtype: product.subtype ?? "",
      isHotDrop: !!product.isHotDrop,
      isOnSale: !!product.isOnSale,
      isNewArrival: !!product.isNewArrival,
      sizes: product.sizes ?? [],
      colors: product.colors ?? [],
      brandId: getBrandId(product),
      categoryId: "",
      styleId: getStyleId(product),
    });
  }, [open, product]);

  const update = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setCategoryId = (id: string) => {
    setForm((prev) => ({ ...prev, categoryId: id }));
  };

  return { form, update, setCategoryId };
}
