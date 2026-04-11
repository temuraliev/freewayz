import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User, TelegramUser, UserStatus } from "@shared/types";

interface UserState {
  // Telegram user data (from WebApp)
  telegramUser: TelegramUser | null;

  // App user data (from Sanity)
  user: User | null;

  // Loading state
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  setTelegramUser: (user: TelegramUser | null) => void;
  setUser: (user: User | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setIsInitialized: (isInitialized: boolean) => void;

  // Computed helpers
  getDisplayName: () => string;
  getStatusLabel: () => string;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      telegramUser: null,
      user: null,
      isLoading: true,
      isInitialized: false,

      setTelegramUser: (telegramUser) => set({ telegramUser }),

      setUser: (user) => set({ user }),

      setIsLoading: (isLoading) => set({ isLoading }),

      setIsInitialized: (isInitialized) => set({ isInitialized }),

      getDisplayName: () => {
        const state = get();

        if (state.user?.username) {
          return `@${state.user.username}`;
        }

        if (state.telegramUser) {
          const { first_name, last_name, username } = state.telegramUser;
          if (username) return `@${username}`;
          return [first_name, last_name].filter(Boolean).join(" ") || "User";
        }

        return "Guest";
      },

      getStatusLabel: () => {
        const status = get().user?.status || "ROOKIE";
        const labels: Record<UserStatus, string> = {
          ROOKIE: "Rookie",
          PRO: "Pro",
          LEGEND: "Legend",
        };
        return labels[status];
      },
    }),
    {
      name: "freewayz-user",
      partialize: (state) => ({
        telegramUser: state.telegramUser,
        user: state.user,
      }),
    }
  )
);
