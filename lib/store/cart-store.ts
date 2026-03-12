import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CartItem, Product, Size, Color } from "@/lib/types";
import { telegramStorage } from "@/lib/store/telegram-storage";

interface CartState {
  items: CartItem[];
  isOpen: boolean;

  // Actions
  addItem: (product: Product, size: Size, color: Color | null) => void;
  removeItem: (productId: string, size: Size, color: Color | null) => void;
  updateQuantity: (
    productId: string,
    size: Size,
    color: Color | null,
    quantity: number
  ) => void;
  clearCart: () => void;
  setIsOpen: (isOpen: boolean) => void;
  toggleCart: () => void;

  // Computed
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (product, size, color) => {
        set((state) => {
          const existingIndex = state.items.findIndex(
            (item) =>
              item.product._id === product._id &&
              item.size === size &&
              item.color === color
          );

          if (existingIndex !== -1) {
            // Update quantity if item exists
            const newItems = [...state.items];
            newItems[existingIndex].quantity += 1;
            return { items: newItems };
          }

          // Add new item
          return {
            items: [
              ...state.items,
              { product, size, color, quantity: 1 },
            ],
          };
        });
      },

      removeItem: (productId, size, color) => {
        set((state) => ({
          items: state.items.filter(
            (item) =>
              !(
                item.product._id === productId &&
                item.size === size &&
                item.color === color
              )
          ),
        }));
      },

      updateQuantity: (productId, size, color, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId, size, color);
          return;
        }

        set((state) => ({
          items: state.items.map((item) =>
            item.product._id === productId &&
            item.size === size &&
            item.color === color
              ? { ...item, quantity }
              : item
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      setIsOpen: (isOpen) => set({ isOpen }),

      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      getTotal: () => {
        return get().items.reduce(
          (total, item) => total + item.product.price * item.quantity,
          0
        );
      },

      getItemCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0);
      },
    }),
    {
      name: "freewayz-cart",
      storage: createJSONStorage(() => telegramStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
