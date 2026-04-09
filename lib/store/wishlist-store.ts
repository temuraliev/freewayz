import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Product } from "@/lib/types";
import { telegramStorage } from "./telegram-storage";

function getInitData(): string {
  if (typeof window === "undefined") return "";
  return window.Telegram?.WebApp?.initData ?? "";
}

interface WishlistState {
  items: Product[];
  toggleItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  clearWishlist: () => void;
  isInWishlist: (productId: string) => boolean;
  /** Hydrate wishlist from server (call on app init when user is authenticated). */
  syncFromServer: () => Promise<void>;
}

async function pushAdd(product: Product) {
  const initData = getInitData();
  if (!initData) return;
  await fetch("/api/user/wishlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      initData,
      productId: product._id,
      title: product.title,
      brand: typeof product.brand === "string" ? product.brand : product.brand?.title,
      price: product.price,
      imageUrl: product.images?.[0],
    }),
  }).catch(() => {});
}

async function pushRemove(productId: string) {
  const initData = getInitData();
  if (!initData) return;
  await fetch(`/api/user/wishlist?productId=${encodeURIComponent(productId)}`, {
    method: "DELETE",
    headers: { "X-Telegram-Init-Data": initData },
  }).catch(() => {});
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      toggleItem: (product) => {
        const items = get().items;
        const exists = items.some((item) => item._id === product._id);
        if (exists) {
          set({ items: items.filter((item) => item._id !== product._id) });
          pushRemove(product._id);
        } else {
          set({ items: [...items, product] });
          pushAdd(product);
        }
      },
      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((item) => item._id !== productId),
        }));
        pushRemove(productId);
      },
      clearWishlist: () => set({ items: [] }),
      isInWishlist: (productId) => get().items.some((item) => item._id === productId),
      syncFromServer: async () => {
        const initData = getInitData();
        if (!initData) return;
        try {
          const res = await fetch("/api/user/wishlist", {
            headers: { "X-Telegram-Init-Data": initData },
          });
          if (!res.ok) return;
          const data = await res.json();
          const serverItems = Array.isArray(data?.items) ? data.items : [];
          // Merge server items into local — server is source of truth for ids,
          // but we keep already-loaded full Product objects from local cache.
          const localById = new Map(get().items.map((p) => [p._id, p]));
          const merged: Product[] = serverItems
            .map((row: { productId: string; title?: string; brand?: string; price?: number; imageUrl?: string }) => {
              const local = localById.get(row.productId);
              if (local) return local;
              // Reconstruct minimal Product shape
              return {
                _id: row.productId,
                title: row.title ?? "",
                slug: { current: "" },
                price: row.price ?? 0,
                images: row.imageUrl ? [row.imageUrl] : [],
                category: null,
                style: null,
                brand: row.brand ? { _id: "", title: row.brand, slug: { current: "" } } : null,
                sizes: [],
                colors: [],
              } as Product;
            })
            .filter((p: Product) => p._id);
          set({ items: merged });
        } catch {
          // ignore
        }
      },
    }),
    {
      name: "freewayz-wishlist",
      storage: createJSONStorage(() => telegramStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
