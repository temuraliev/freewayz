"use client";

import { useEffect } from "react";
import { useAdminStore } from "@/lib/store";
import { ProductEditOverlay } from "@/components/admin/product-edit-overlay";
import { admin as adminApi } from "@/lib/api-client";

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
    adminApi.checkAuth(initData)
      .then(() => {
        setAdmin(true);
      })
      .catch((err) => {
        setAdmin(false);
        if (err?.body?.reason) {
          console.warn("[Admin] Auth failed:", err.body.reason);
        }
      });
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
