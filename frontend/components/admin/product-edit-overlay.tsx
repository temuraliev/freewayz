"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@frontend/components/ui/sheet";
import { Product } from "@shared/types";
import { toast } from "@frontend/components/ui/use-toast";
import { useProductForm } from "./use-product-form";
import { useProductImages } from "./use-product-images";
import { useCatalogRefs } from "./use-catalog-refs";
import { ProductImageManager } from "./product-image-manager";

interface ProductEditOverlayProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

function getInitData(): string {
  if (typeof window === "undefined") return "";
  return window.Telegram?.WebApp?.initData ?? "";
}

export function ProductEditOverlay({
  product,
  open,
  onOpenChange,
  onSaved,
}: ProductEditOverlayProps) {
  const { form, update, setCategoryId } = useProductForm(product, open);
  const { brands, categories, styles } = useCatalogRefs(open);
  const images = useProductImages(product._id, open, product.images ?? []);
  const [saving, setSaving] = useState(false);

  // Resolve categoryId from slug after categories load
  useEffect(() => {
    if (!open || !categories.length) return;
    const catSlug =
      product.category && typeof product.category !== "string"
        ? product.category.slug?.current
        : "";
    if (catSlug) {
      const cat = categories.find((x) => (x.slug?.current ?? "") === catSlug);
      if (cat?._id) setCategoryId(cat._id);
    }
  }, [open, categories, product.category, setCategoryId]);

  const handleSave = async () => {
    const priceNum = parseInt(form.price, 10);
    const originalPriceNum = form.originalPrice.trim() ? parseInt(form.originalPrice, 10) : null;
    if (Number.isNaN(priceNum) || priceNum <= 0) {
      toast({ title: "Укажите цену", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const initData = getInitData();
      const res = await fetch(
        `/api/admin/products/${encodeURIComponent(product._id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            initData,
            title: form.title.trim() || undefined,
            description: form.description.trim() || null,
            price: priceNum,
            originalPrice: originalPriceNum,
            subtype: form.subtype.trim() || null,
            isHotDrop: form.isHotDrop,
            isOnSale: form.isOnSale,
            isNewArrival: form.isNewArrival,
            sizes: form.sizes,
            colors: form.colors,
            brandId: form.brandId || null,
            categoryId: form.categoryId || null,
            styleId: form.styleId || null,
            ...(images.imageRefs.length > 0 ? { imageRefs: images.imageRefs } : {}),
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Ошибка сохранения");
      }
      toast({ title: "Сохранено" });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Ошибка",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Редактировать товар</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Название</label>
            <input
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Описание</label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
              className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Цена (UZS)</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => update("price", e.target.value)}
                className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Было (UZS)</label>
              <input
                type="number"
                value={form.originalPrice}
                onChange={(e) => update("originalPrice", e.target.value)}
                placeholder="—"
                className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Подтип</label>
            <input
              value={form.subtype}
              onChange={(e) => update("subtype", e.target.value)}
              className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <ProductImageManager
            imageRefs={images.imageRefs}
            imageUrls={images.imageUrls}
            loading={images.loading}
            uploading={images.uploading}
            onMove={images.moveImage}
            onReorder={images.reorderTo}
            onRemove={images.removeImage}
            onUpload={images.uploadImage}
          />

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isHotDrop}
                onChange={(e) => update("isHotDrop", e.target.checked)}
              />
              Hot Drop
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isOnSale}
                onChange={(e) => update("isOnSale", e.target.checked)}
              />
              Скидка
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isNewArrival}
                onChange={(e) => update("isNewArrival", e.target.checked)}
              />
              Новинка
            </label>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Бренд</label>
            <select
              value={form.brandId}
              onChange={(e) => update("brandId", e.target.value)}
              className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {brands.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Категория</label>
            <select
              value={form.categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Стиль</label>
            <select
              value={form.styleId}
              onChange={(e) => update("styleId", e.target.value)}
              className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {styles.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Размеры (через запятую)
            </label>
            <input
              value={form.sizes.join(", ")}
              onChange={(e) =>
                update(
                  "sizes",
                  e.target.value.split(",").map((x) => x.trim()).filter(Boolean)
                )
              }
              className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
              placeholder="S, M, L, XL"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Цвета (через запятую)
            </label>
            <input
              value={form.colors.join(", ")}
              onChange={(e) =>
                update(
                  "colors",
                  e.target.value.split(",").map((x) => x.trim()).filter(Boolean)
                )
              }
              className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
              placeholder="Black, White"
            />
          </div>
        </div>
        <SheetFooter>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-foreground px-6 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
