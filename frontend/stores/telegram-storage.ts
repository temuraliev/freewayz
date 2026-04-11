import { StateStorage } from "zustand/middleware";

export const telegramStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    // 1. First, always try to get from localStorage (fastest and sync)
    const localData = typeof window !== "undefined" ? window.localStorage.getItem(name) : null;

    // 2. Try to get from Telegram CloudStorage as a fallback or source of truth
    if (typeof window !== "undefined") {
      const tg = (window as Window & { Telegram?: { WebApp?: { CloudStorage?: any } } }).Telegram?.WebApp;
      if (tg?.CloudStorage) {
        return new Promise((resolve) => {
          tg.CloudStorage.getItem(name, (err: any, value: string) => {
            if (!err && value) {
              // If CloudStorage has it, sync it back to localStorage for faster future reads
              window.localStorage.setItem(name, value);
              resolve(value);
            } else {
              // If error or empty, fallback to what we had in localStorage
              resolve(localData);
            }
          });
        });
      }
    }

    return localData || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    // 1. Always save to localStorage immediately for fast reads
    if (typeof window !== "undefined") {
      window.localStorage.setItem(name, value);
    }

    // 2. Sync to Telegram CloudStorage in the background
    if (typeof window !== "undefined") {
      const tg = (window as Window & { Telegram?: { WebApp?: { CloudStorage?: any } } }).Telegram?.WebApp;
      if (tg?.CloudStorage) {
        return new Promise((resolve) => {
          tg.CloudStorage.setItem(name, value, (err: any, stored: boolean) => {
            if (err) console.error("Telegram CloudStorage error:", err);
            resolve();
          });
        });
      }
    }
  },
  removeItem: async (name: string): Promise<void> => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(name);
    }
    
    if (typeof window !== "undefined") {
      const tg = (window as Window & { Telegram?: { WebApp?: { CloudStorage?: any } } }).Telegram?.WebApp;
      if (tg?.CloudStorage) {
        return new Promise((resolve) => {
          tg.CloudStorage.removeItem(name, (err: any, removed: boolean) => {
            resolve();
          });
        });
      }
    }
  },
};
