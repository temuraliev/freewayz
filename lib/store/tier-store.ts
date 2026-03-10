import { create } from "zustand";
import { ProductTier } from "@/lib/types";

const STORAGE_KEY = "freewayz-tier";

function loadPersistedTier(): ProductTier {
  if (typeof window === "undefined") return "ultimate";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "top" || v === "ultimate") return v;
  } catch {}
  return "ultimate";
}

interface TierStoreState {
  tier: ProductTier;
  setTier: (tier: ProductTier) => void;
  toggleTier: () => void;
}

export const useTierStore = create<TierStoreState>()((set) => ({
  tier: loadPersistedTier(),

  setTier: (tier) => {
    try { localStorage.setItem(STORAGE_KEY, tier); } catch {}
    set({ tier });
  },

  toggleTier: () =>
    set((state) => {
      const next: ProductTier = state.tier === "ultimate" ? "top" : "ultimate";
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
      return { tier: next };
    }),
}));
