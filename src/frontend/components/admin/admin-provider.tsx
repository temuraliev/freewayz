"use client";

import { useEffect } from "react";
import { useAdminStore } from "@frontend/stores";
import { ProductEditOverlay } from "@frontend/components/admin/product-edit-overlay";

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const setAdmin = useAdminStore((s) => s.setAdmin);
  const editingProduct = useAdminStore((s) => s.editingProduct);
  const setEditingProduct = useAdminStore((s) => s.setEditingProduct);
  const setCatalogInvalidated = useAdminStore((s) => s.setCatalogInvalidated);

  useEffect(() => {
    const initData =
      typeof window !== "undefined" && window.Telegram?.WebApp?.initData
        ? window.Telegram.WebApp.initData
        : "";
    fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setAdmin(true);
        } else {
          setAdmin(false);
          // Debug: в консоли видно, почему не админ (только при открытии из Telegram)
          if (data.reason) {
            console.warn("[Admin] Auth failed:", data.reason);
          }
        }
      })
      .catch(() => setAdmin(false));
  }, [setAdmin]);

  const handleSaved = () => {
    setEditingProduct(null);
    setCatalogInvalidated();
  };

  return (
    <>
      {children}
      {editingProduct && (
        <ProductEditOverlay
          product={editingProduct}
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
