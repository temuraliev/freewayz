"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import { ProductGrid } from "@/components/products/product-grid";
import { useUserStore } from "@/lib/store";
import { Product } from "@/lib/types";

export default function RecommendationsPage() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const telegramUser = useUserStore((s) => s.telegramUser);
  const isInitialized = useUserStore((s) => s.isInitialized);

  const [products, setProducts] = useState<Product[]>([]);
  const [tier, setTier] = useState(3);
  const [loading, setLoading] = useState(true);

  const fetchRecs = useCallback(async () => {
    const initData =
      typeof window !== "undefined" && window.Telegram?.WebApp?.initData
        ? window.Telegram.WebApp.initData
        : "";

    try {
      const res = await fetch(`/api/recommendations`, {
        headers: {
          "X-Telegram-Init-Data": initData,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setTier(data.tier ?? 3);
      }
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    // If user has no orders and hasn't done onboarding, redirect
    if (user && !user.onboardingDone && !(user.totalSpent > 0)) {
      router.replace("/onboarding");
      return;
    }

    fetchRecs();
  }, [isInitialized, user, router, fetchRecs]);

  const tierTitle =
    tier === 1
      ? "Подобрано для тебя"
      : tier === 2
        ? "По твоим предпочтениям"
        : "Популярное";

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="flex h-14 items-center justify-between px-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
            Назад
          </button>
          <h1 className="flex items-center gap-1.5 font-headline text-lg tracking-wider">
            <Sparkles className="h-4 w-4 text-primary" />
            Рекомендации
          </h1>
          <div className="w-16" />
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] animate-pulse rounded-lg bg-secondary"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex min-h-[50vh] flex-col items-center justify-center text-center"
          >
            <Sparkles className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">
              Пока нет рекомендаций. Загляни позже!
            </p>
          </motion.div>
        ) : (
          <>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {tierTitle}
            </h2>
            <ProductGrid products={products} />
          </>
        )}
      </div>
    </div>
  );
}
