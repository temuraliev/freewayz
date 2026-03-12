import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Product } from "@/lib/types";
import { telegramStorage } from "./telegram-storage";

interface WishlistState {
  items: Product[];
  toggleItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  clearWishlist: () => void;
  isInWishlist: (productId: string) => boolean;
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
        } else {
          set({ items: [...items, product] });
        }
      },
      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((item) => item._id !== productId),
        })),
      clearWishlist: () => set({ items: [] }),
      isInWishlist: (productId) => get().items.some((item) => item._id === productId),
    }),
    {
      name: "freewayz-wishlist", // unique name
      // Use our robust telegramStorage adapter
      storage: createJSONStorage(() => telegramStorage),
      // Only serialize the items array to save space
      partialize: (state) => ({ items: state.items }),
    }
  )
);
