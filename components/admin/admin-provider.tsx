"use client";

import { useEffect } from "react";
import { useAdminStore } from "@/lib/store";

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const setAdmin = useAdminStore((s) => s.setAdmin);

  useEffect(() => {
    const initData =
      typeof window !== "undefined" && window.Telegram?.WebApp?.initData
        ? window.Telegram.WebApp.initData
        : "";
    if (!initData.trim()) {
      setAdmin(false);
      return;
    }
    fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    })
      .then((res) => {
        setAdmin(res.ok);
      })
      .catch(() => setAdmin(false));
  }, [setAdmin]);

  return <>{children}</>;
}
