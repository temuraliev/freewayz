import { create } from "zustand";
import { FilterState } from "@/lib/types";

export type SortBy = "default" | "price-asc" | "price-desc" | "name-asc" | "name-desc" | "newest";

interface FilterStoreState extends FilterState {
  searchQuery: string;
  sortBy: SortBy;
  priceMin: number | null;
  priceMax: number | null;

  setSearchQuery: (q: string) => void;
  clearSearch: () => void;
  setSaleOnly: (saleOnly: boolean) => void;
  setStyle: (style: string | null) => void;
  setBrand: (brand: string | null) => void;
  setCategory: (category: string | null) => void;
  setSubtype: (subtype: string | null) => void;
  setSortBy: (sortBy: SortBy) => void;
  setPriceRange: (min: number | null, max: number | null) => void;
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
  sortBy: "default",
  priceMin: null,
  priceMax: null,

  setSearchQuery: (searchQuery) => set({ searchQuery: searchQuery.trim() }),

  clearSearch: () => set({ searchQuery: "" }),

  setSaleOnly: (saleOnly) => set({ saleOnly }),

  setStyle: (style) => set({ style }),

  setBrand: (brand) => set({ brand }),

  setCategory: (category) => set({ category, subtype: null }),

  setSubtype: (subtype) => set({ subtype }),

  setSortBy: (sortBy) => set({ sortBy }),

  setPriceRange: (priceMin, priceMax) => set({ priceMin, priceMax }),

  clearFilters: () =>
    set({
      style: null,
      brand: null,
      category: null,
      subtype: null,
      saleOnly: false,
      sortBy: "default",
      priceMin: null,
      priceMax: null,
    }),

  hasActiveFilters: () => {
    const state = get();
    return (
      state.style !== null ||
      state.brand !== null ||
      state.category !== null ||
      state.subtype !== null ||
      state.saleOnly === true ||
      state.priceMin !== null ||
      state.priceMax !== null
    );
  },
}));
