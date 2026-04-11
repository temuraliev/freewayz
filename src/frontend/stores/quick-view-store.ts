"use client";

import { create } from "zustand";
import { Product } from "@shared/types";

interface QuickViewStore {
  isOpen: boolean;
  product: Product | null;
  openQuickView: (product: Product) => void;
  closeQuickView: () => void;
}

export const useQuickViewStore = create<QuickViewStore>((set) => ({
  isOpen: false,
  product: null,
  openQuickView: (product) => set({ isOpen: true, product }),
  closeQuickView: () => set({ isOpen: false, product: null }),
}));
