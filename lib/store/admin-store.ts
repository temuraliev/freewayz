import { create } from "zustand";
import type { Product } from "@/lib/types";

interface AdminStoreState {
  isAdmin: boolean | null;
  setAdmin: (value: boolean) => void;
  editingProductId: string | null;
  setEditingProductId: (id: string | null) => void;
  /** Product to edit in overlay (from catalog). When set, global overlay opens. */
  editingProduct: Product | null;
  setEditingProduct: (product: Product | null) => void;
  /** Increment to trigger catalog refetch after save from overlay. */
  catalogInvalidated: number;
  setCatalogInvalidated: () => void;
}

export const useAdminStore = create<AdminStoreState>()((set) => ({
  isAdmin: null,
  setAdmin: (value) => set({ isAdmin: value }),
  editingProductId: null,
  setEditingProductId: (id) => set({ editingProductId: id }),
  editingProduct: null,
  setEditingProduct: (product) => set({ editingProduct: product }),
  catalogInvalidated: 0,
  setCatalogInvalidated: () => set((s) => ({ catalogInvalidated: s.catalogInvalidated + 1 })),
}));
