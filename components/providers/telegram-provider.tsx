"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUserStore, useCartStore } from "@/lib/store";
import { TelegramUser } from "@/lib/types";

interface TelegramContextType {
  isReady: boolean;
  webApp: typeof window.Telegram.WebApp | null;
}

const TelegramContext = createContext<TelegramContextType>({
  isReady: false,
  webApp: null,
});

export const useTelegram = () => useContext(TelegramContext);

interface TelegramProviderProps {
  children: ReactNode;
}

// Extend Window interface for Telegram
declare global {
  interface Window {
    Telegram: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        enableClosingConfirmation: () => void;
        disableClosingConfirmation: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        initData: string;
        initDataUnsafe: {
          user?: TelegramUser;
          query_id?: string;
          auth_date?: number;
          hash?: string;
          start_param?: string; // deep link param: t.me/bot/app?startapp=PARAM
        };
        colorScheme: "light" | "dark";
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
        };
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          setText: (text: string) => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
        };
        BackButton: {
          isVisible: boolean;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
        };
        HapticFeedback: {
          impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
          notificationOccurred: (type: "error" | "success" | "warning") => void;
          selectionChanged: () => void;
        };
        openLink: (url: string) => void;
        openTelegramLink: (url: string) => void;
        showAlert: (message: string) => void;
        showConfirm: (message: string, callback: (confirmed: boolean) => void) => void;
      };
    };
  }
}

export function TelegramProvider({ children }: TelegramProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [webApp, setWebApp] = useState<typeof window.Telegram.WebApp | null>(null);
  const { setTelegramUser, setIsLoading, setIsInitialized } = useUserStore();
  const router = useRouter();

  useEffect(() => {
    // Check if running in Telegram WebApp
    const initTelegram = () => {
      if (typeof window !== "undefined" && window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;

        // Initialize WebApp
        tg.ready();
        tg.expand();

        // Set theme colors
        tg.setHeaderColor("#0a0a0a");
        tg.setBackgroundColor("#0a0a0a");

        // Get user data
        const user = tg.initDataUnsafe?.user;
        if (user) {
          setTelegramUser({
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
            language_code: user.language_code,
            photo_url: user.photo_url,
          });
        }

        setWebApp(tg);
        setIsReady(true);

        // Deep link handling
        const startParam = tg.initDataUnsafe?.start_param;
        if (startParam) {
          if (startParam.startsWith("ref_")) {
            const referrerId = startParam.replace("ref_", "");
            // Link referral in background
            fetch("/api/user/link-referral", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                initData: tg.initData,
                referrerId: referrerId,
              }),
            }).catch(err => console.error("Referral linking failed:", err));
          } else {
            // start_param is the product slug
            router.push(`/product/${startParam}`);
          }
        }
      } else {
        // Running outside Telegram (for development)
        console.log("Running outside Telegram WebApp");

        // Set mock user for development
        if (process.env.NODE_ENV === "development") {
          setTelegramUser({
            id: 123456789,
            first_name: "Dev",
            last_name: "User",
            username: "devuser",
          });
        }
      }

      setIsLoading(false);
      setIsInitialized(true);
    };

    // Small delay to ensure Telegram script is loaded
    const timer = setTimeout(initTelegram, 100);

    return () => clearTimeout(timer);
  }, [setTelegramUser, setIsLoading, setIsInitialized]);

  const fetchedRef = useRef(false);
  const telegramUser = useUserStore((s) => s.telegramUser);
  const setUser = useUserStore((s) => s.setUser);

  useEffect(() => {
    if (!telegramUser?.id || fetchedRef.current) return;
    fetchedRef.current = true;

    const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : null;
    const initData = tg?.initData || "";
    if (!initData) return;

    fetch("/api/user/me", {
      headers: { "X-Telegram-Init-Data": initData },
    })
      .then((res) => res.json())
      .then((doc) => { if (doc && !doc.error) setUser(doc); })
      .catch((err) => console.error("Failed to fetch user:", err));
  }, [telegramUser, setUser]);

  // Sync Cart with Backend
  const cartItems = useCartStore((s) => s.items);
  
  useEffect(() => {
    if (!telegramUser?.id) return;
    
    const tg = window?.Telegram?.WebApp;
    if (!tg?.initData) return;

    const timer = setTimeout(() => {
      fetch("/api/user/sync-cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: tg.initData,
          cartItems,
        }),
      }).catch(err => console.error("Cart sync failed:", err));
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [cartItems, telegramUser?.id]);

  return (
    <TelegramContext.Provider value={{ isReady, webApp }}>
      {children}
    </TelegramContext.Provider>
  );
}

// Hook for haptic feedback
export function useHapticFeedback() {
  const { webApp } = useTelegram();

  return {
    impact: (style: "light" | "medium" | "heavy" | "rigid" | "soft" = "medium") => {
      webApp?.HapticFeedback?.impactOccurred(style);
    },
    notification: (type: "error" | "success" | "warning") => {
      webApp?.HapticFeedback?.notificationOccurred(type);
    },
    selection: () => {
      webApp?.HapticFeedback?.selectionChanged();
    },
  };
}
