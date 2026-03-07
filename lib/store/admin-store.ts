import { create } from "zustand";

interface AdminStoreState {
  isAdmin: boolean | null;
  setAdmin: (value: boolean) => void;
  editingProductId: string | null;
  setEditingProductId: (id: string | null) => void;
}

export const useAdminStore = create<AdminStoreState>()((set) => ({
  isAdmin: null,
  setAdmin: (value) => set({ isAdmin: value }),
  editingProductId: null,
  setEditingProductId: (id) => set({ editingProductId: id }),
}));
