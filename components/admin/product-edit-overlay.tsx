"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { ChevronUp, ChevronDown, Trash2, Plus } from "lucide-react";
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
  const [imageRefs, setImageRefs] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!open || !product._id) return;
    setImagesLoading(true);
    fetch(`/api/admin/products/${encodeURIComponent(product._id)}`, initData ? {
      headers: { "X-Telegram-Init-Data": initData },
    } : undefined)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load"))))
      .then((data: { images?: { _ref: string; url: string }[] }) => {
        const imgs = data.images ?? [];
        setImageRefs(imgs.map((i) => i._ref).filter(Boolean));
        setImageUrls(imgs.map((i) => i.url));
      })
      .catch(() => {
        setImageRefs([]);
        setImageUrls(product.images ?? []);
      })
      .finally(() => setImagesLoading(false));
  }, [open, initData, product._id, product.images]);

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

  const moveImage = (index: number, direction: "up" | "down") => {
    const next = direction === "up" ? index - 1 : index + 1;
    if (next < 0 || next >= imageRefs.length) return;
    setImageRefs((prev) => {
      const arr = [...prev];
      [arr[index], arr[next]] = [arr[next], arr[index]];
      return arr;
    });
    setImageUrls((prev) => {
      const arr = [...prev];
      [arr[index], arr[next]] = [arr[next], arr[index]];
      return arr;
    });
  };

  const reorderImageTo = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= imageRefs.length) return;
    setImageRefs((prev) => {
      const arr = [...prev];
      const [removed] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, removed);
      return arr;
    });
    setImageUrls((prev) => {
      const arr = [...prev];
      const [removed] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, removed);
      return arr;
    });
  };

  const handlePhotoPointerDown = (e: React.PointerEvent, index: number) => {
    if (e.button !== 0 && e.pointerType !== "touch") return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragIndex(index);
    setDropTargetIndex(index);
  };

  const handlePhotoPointerMove = (e: React.PointerEvent) => {
    if (dragIndex === null) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const item = el?.closest("[data-photo-index]");
    if (item) {
      const idx = parseInt(item.getAttribute("data-photo-index") ?? "-1", 10);
      if (idx >= 0 && idx < imageRefs.length) setDropTargetIndex(idx);
    }
  };

  const handlePhotoPointerUp = (e: React.PointerEvent) => {
    if (dragIndex === null) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (dropTargetIndex !== null && dropTargetIndex !== dragIndex) {
      reorderImageTo(dragIndex, dropTargetIndex);
    }
    setDragIndex(null);
    setDropTargetIndex(null);
  };

  const handlePhotoPointerLeave = () => {
    if (dragIndex !== null) {
      setDropTargetIndex(dragIndex);
    }
  };

  const removeImage = (index: number) => {
    setImageRefs((prev) => prev.filter((_, i) => i !== index));
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !product._id) return;
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append("initData", initData);
      form.append("image", file);
      const res = await fetch(`/api/admin/products/${encodeURIComponent(product._id)}/upload-image`, {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
      if (data.assetId && data.url) {
        setImageRefs((prev) => [...prev, data.assetId]);
        setImageUrls((prev) => [...prev, data.url]);
        toast({ title: "Фото добавлено" });
      }
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Ошибка загрузки", variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
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
            ...(imageRefs.length > 0 ? { imageRefs } : {}),
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
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Фото (зажмите и перетащите для смены порядка)</label>
            {imagesLoading ? (
              <div className="flex gap-2 flex-wrap">
                <div className="w-20 h-20 bg-secondary animate-pulse rounded" />
                <div className="w-20 h-20 bg-secondary animate-pulse rounded" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {imageUrls.map((url, i) => (
                  <div
                    key={imageRefs[i] ?? i}
                    data-photo-index={i}
                    className="relative group"
                    style={{ touchAction: dragIndex === i ? "none" : "auto" }}
                    onPointerDown={(e) => handlePhotoPointerDown(e, i)}
                    onPointerMove={handlePhotoPointerMove}
                    onPointerUp={handlePhotoPointerUp}
                    onPointerCancel={handlePhotoPointerUp}
                    onPointerLeave={handlePhotoPointerLeave}
                  >
                    <div
                      className={`w-20 h-20 relative rounded border overflow-hidden bg-secondary transition-all ${
                        dragIndex === i
                          ? "opacity-60 scale-95 z-10 border-primary ring-2 ring-primary"
                          : dropTargetIndex === i && dragIndex !== null
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                            : "border-border"
                      }`}
                    >
                      <Image src={url} alt="" fill className="object-cover pointer-events-none select-none" sizes="80px" unoptimized draggable={false} />
                    </div>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-0.5 rounded pointer-events-none">
                      <span className="p-1.5 bg-background/90 text-foreground rounded text-[10px] font-mono">{i + 1}</span>
                    </div>
                    <span className="absolute left-1 bottom-1 text-[10px] font-mono bg-black/70 text-white px-1 rounded">
                      {i + 1}
                    </span>
                    <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition" onPointerDown={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); moveImage(i, "up"); }}
                        disabled={i === 0}
                        className="p-1 bg-background/90 text-foreground rounded disabled:opacity-30"
                        aria-label="Вверх"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); moveImage(i, "down"); }}
                        disabled={i === imageUrls.length - 1}
                        className="p-1 bg-background/90 text-foreground rounded disabled:opacity-30"
                        aria-label="Вниз"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                        className="p-1 bg-red-600/90 text-white rounded"
                        aria-label="Удалить"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
                <label className="w-20 h-20 flex flex-col items-center justify-center border border-dashed border-border rounded cursor-pointer hover:bg-muted/50 transition bg-secondary/30">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUploadImage}
                    disabled={uploadingImage}
                  />
                  {uploadingImage ? (
                    <span className="text-[10px] text-muted-foreground">Загрузка…</span>
                  ) : (
                    <>
                      <Plus className="h-6 w-6 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground mt-1">Добавить</span>
                    </>
                  )}
                </label>
              </div>
            )}
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
