import { create } from "zustand";
import { FilterState } from "@/lib/types";

interface FilterStoreState extends FilterState {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  clearSearch: () => void;
  setSaleOnly: (saleOnly: boolean) => void;
  setStyle: (style: string | null) => void;
  setBrand: (brand: string | null) => void;
  setCategory: (category: string | null) => void;
  setSubtype: (subtype: string | null) => void;
  clearFilters: () => void;
  hasActiveFilters: () => boolean;
}

export const useFilterStore = create<FilterStoreState>()((set, get) => ({
  style: null,
  brand: null,
  category: null,
  subtype: null,
  saleOnly: false,
  searchQuery: "",

  setSearchQuery: (searchQuery) => set({ searchQuery: searchQuery.trim() }),

  clearSearch: () => set({ searchQuery: "" }),

  setSaleOnly: (saleOnly) => set({ saleOnly }),

  setStyle: (style) => set({ style }),

  setBrand: (brand) => set({ brand }),

  setCategory: (category) => set({ category, subtype: null }),

  setSubtype: (subtype) => set({ subtype }),

  clearFilters: () =>
    set({
      style: null,
      brand: null,
      category: null,
      subtype: null,
      saleOnly: false,
    }),

  hasActiveFilters: () => {
    const state = get();
    return (
      state.style !== null ||
      state.brand !== null ||
      state.category !== null ||
      state.subtype !== null ||
      state.saleOnly === true
    );
  },
}));
