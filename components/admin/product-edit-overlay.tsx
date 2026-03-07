"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Product } from "@/lib/types";
import { client } from "@/lib/sanity/client";
import { categoriesQuery, brandsQuery, stylesQuery } from "@/lib/sanity/queries";
import { toast } from "@/components/ui/use-toast";

interface CatalogRef {
  _id: string;
  title: string;
  slug: { current: string };
}

interface ProductEditOverlayProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function ProductEditOverlay({
  product,
  open,
  onOpenChange,
  onSaved,
}: ProductEditOverlayProps) {
  const initData =
    typeof window !== "undefined" && window.Telegram?.WebApp?.initData
      ? window.Telegram.WebApp.initData
      : "";

  const [title, setTitle] = useState(product.title);
  const [description, setDescription] = useState(product.description ?? "");
  const [price, setPrice] = useState(String(product.price));
  const [originalPrice, setOriginalPrice] = useState(
    product.originalPrice != null ? String(product.originalPrice) : ""
  );
  const [subtype, setSubtype] = useState(product.subtype ?? "");
  const [isHotDrop, setIsHotDrop] = useState(!!product.isHotDrop);
  const [isOnSale, setIsOnSale] = useState(!!product.isOnSale);
  const [isNewArrival, setIsNewArrival] = useState(!!product.isNewArrival);
  const [sizes, setSizes] = useState<string[]>(product.sizes ?? []);
  const [colors, setColors] = useState<string[]>(product.colors ?? []);
  const [brandId, setBrandId] = useState<string>(
    (product.brand && typeof product.brand !== "string" ? product.brand._id : "") ?? ""
  );
  const [categoryId, setCategoryId] = useState<string>("");
  const [styleId, setStyleId] = useState<string>(
    (product.style && typeof product.style !== "string" ? product.style._id : "") ?? ""
  );

  const [brands, setBrands] = useState<CatalogRef[]>([]);
  const [categories, setCategories] = useState<(CatalogRef & { subtypes?: string[] })[]>([]);
  const [styles, setStyles] = useState<CatalogRef[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(product.title);
    setDescription(product.description ?? "");
    setPrice(String(product.price));
    setOriginalPrice(product.originalPrice != null ? String(product.originalPrice) : "");
    setSubtype(product.subtype ?? "");
    setIsHotDrop(!!product.isHotDrop);
    setIsOnSale(!!product.isOnSale);
    setIsNewArrival(!!product.isNewArrival);
    setSizes(product.sizes ?? []);
    setColors(product.colors ?? []);
    setBrandId((product.brand && typeof product.brand !== "string" ? product.brand._id : "") ?? "");
    setCategoryId("");
    setStyleId((product.style && typeof product.style !== "string" ? product.style._id : "") ?? "");
  }, [open, product]);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      client.fetch<CatalogRef[]>(brandsQuery),
      client.fetch<(CatalogRef & { subtypes?: string[] })[]>(categoriesQuery),
      client.fetch<CatalogRef[]>(stylesQuery),
    ]).then(([b, c, s]) => {
      setBrands(b ?? []);
      setCategories(c ?? []);
      setStyles(s ?? []);
      const catSlug = product.category && typeof product.category !== "string" ? product.category.slug?.current : "";
      if (catSlug && c?.length) {
        const cat = (c ?? []).find((x) => (x.slug?.current ?? "") === catSlug);
        if (cat?._id) setCategoryId(cat._id);
      }
    });
  }, [open, product]);

  const handleSave = async () => {
    if (!initData) {
      toast({ title: "Нет доступа", variant: "destructive" });
      return;
    }
    const priceNum = parseInt(price, 10);
    const originalPriceNum = originalPrice.trim() ? parseInt(originalPrice, 10) : null;
    if (Number.isNaN(priceNum) || priceNum <= 0) {
      toast({ title: "Укажите цену", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/products/${encodeURIComponent(product._id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            initData,
            title: title.trim() || undefined,
            description: description.trim() || null,
            price: priceNum,
            originalPrice: originalPriceNum,
            subtype: subtype.trim() || null,
            isHotDrop,
            isOnSale,
            isNewArrival,
            sizes,
            colors,
            brandId: brandId || null,
            categoryId: categoryId || null,
            styleId: styleId || null,
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
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Цена (UZS)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Было (UZS)</label>
              <input
                type="number"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                placeholder="—"
                className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Подтип</label>
            <input
              value={subtype}
              onChange={(e) => setSubtype(e.target.value)}
              className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isHotDrop}
                onChange={(e) => setIsHotDrop(e.target.checked)}
              />
              Hot Drop
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isOnSale}
                onChange={(e) => setIsOnSale(e.target.checked)}
              />
              Скидка
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isNewArrival}
                onChange={(e) => setIsNewArrival(e.target.checked)}
              />
              Новинка
            </label>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Бренд</label>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
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
              value={categoryId}
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
              value={styleId}
              onChange={(e) => setStyleId(e.target.value)}
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
            <label className="text-xs font-medium text-muted-foreground">Размеры (через запятую)</label>
            <input
              value={sizes.join(", ")}
              onChange={(e) =>
                setSizes(
                  e.target.value
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean)
                )
              }
              className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
              placeholder="S, M, L, XL"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Цвета (через запятую)</label>
            <input
              value={colors.join(", ")}
              onChange={(e) =>
                setColors(
                  e.target.value
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean)
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
