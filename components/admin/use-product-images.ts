"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/ui/use-toast";

function getInitData(): string {
  if (typeof window === "undefined") return "";
  return window.Telegram?.WebApp?.initData ?? "";
}

export function useProductImages(productId: string, open: boolean, fallbackUrls: string[]) {
  const [imageRefs, setImageRefs] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open || !productId) return;
    setLoading(true);
    const initData = getInitData();
    fetch(`/api/admin/products/${encodeURIComponent(productId)}`, initData ? {
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
        setImageUrls(fallbackUrls ?? []);
      })
      .finally(() => setLoading(false));
  }, [open, productId, fallbackUrls]);

  const moveImage = useCallback((index: number, direction: "up" | "down") => {
    const next = direction === "up" ? index - 1 : index + 1;
    setImageRefs((prev) => {
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[index], arr[next]] = [arr[next], arr[index]];
      return arr;
    });
    setImageUrls((prev) => {
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[index], arr[next]] = [arr[next], arr[index]];
      return arr;
    });
  }, []);

  const reorderTo = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setImageRefs((prev) => {
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const arr = [...prev];
      const [removed] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, removed);
      return arr;
    });
    setImageUrls((prev) => {
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const arr = [...prev];
      const [removed] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, removed);
      return arr;
    });
  }, []);

  const removeImage = useCallback((index: number) => {
    setImageRefs((prev) => prev.filter((_, i) => i !== index));
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const uploadImage = useCallback(
    async (file: File) => {
      if (!productId) return;
      setUploading(true);
      try {
        const initData = getInitData();
        const form = new FormData();
        form.append("initData", initData);
        form.append("image", file);
        const res = await fetch(
          `/api/admin/products/${encodeURIComponent(productId)}/upload-image`,
          { method: "POST", body: form }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
        if (data.assetId && data.url) {
          setImageRefs((prev) => [...prev, data.assetId]);
          setImageUrls((prev) => [...prev, data.url]);
          toast({ title: "Фото добавлено" });
        }
      } catch (err) {
        toast({
          title: err instanceof Error ? err.message : "Ошибка загрузки",
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    },
    [productId]
  );

  return {
    imageRefs,
    imageUrls,
    loading,
    uploading,
    moveImage,
    reorderTo,
    removeImage,
    uploadImage,
  };
}
