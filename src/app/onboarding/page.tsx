"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

import { Button } from "@frontend/components/ui/button";
import { useUserStore } from "@frontend/stores";

interface Item {
  _id: string;
  title: string;
  slug: { current: string };
}

export default function OnboardingPage() {
  const router = useRouter();
  const telegramUser = useUserStore((s) => s.telegramUser);
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);

  const [brands, setBrands] = useState<Item[]>([]);
  const [styles, setStyles] = useState<Item[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/catalog/brands").then((r) => r.json()),
      fetch("/api/catalog/styles").then((r) => r.json()),
    ]).then(([b, s]) => {
      setBrands(b || []);
      setStyles(s || []);
    });
  }, []);

  const toggleBrand = (id: string) => {
    setSelectedBrands((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleStyle = (id: string) => {
    setSelectedStyles((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalSelected = selectedBrands.size + selectedStyles.size;

  const handleSave = async () => {
    if (totalSelected < 2) return;
    setSaving(true);

    const initData =
      typeof window !== "undefined" && window.Telegram?.WebApp?.initData
        ? window.Telegram.WebApp.initData
        : "";

    try {
      const res = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          brandIds: Array.from(selectedBrands),
          styleIds: Array.from(selectedStyles),
        }),
      });
      if (res.ok && user) {
        setUser({ ...user, onboardingDone: true });
      }
      router.replace("/recommendations");
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 pb-32 pt-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-md"
      >
        <h1 className="font-headline text-2xl tracking-wider">
          Добро пожаловать!
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Выбери минимум 2 любимых бренда или стиля, чтобы мы подобрали для тебя
          лучшие вещи.
        </p>

        {/* Brands */}
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Бренды
          </h2>
          <div className="flex flex-wrap gap-2">
            {brands.map((b) => {
              const active = selectedBrands.has(b._id);
              return (
                <button
                  key={b._id}
                  onClick={() => toggleBrand(b._id)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  {active && <Check className="h-3.5 w-3.5" />}
                  {b.title}
                </button>
              );
            })}
          </div>
        </section>

        {/* Styles */}
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Стили
          </h2>
          <div className="flex flex-wrap gap-2">
            {styles.map((s) => {
              const active = selectedStyles.has(s._id);
              return (
                <button
                  key={s._id}
                  onClick={() => toggleStyle(s._id)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  {active && <Check className="h-3.5 w-3.5" />}
                  {s.title}
                </button>
              );
            })}
          </div>
        </section>
      </motion.div>

      {/* Fixed bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 p-4 backdrop-blur-sm">
        <Button
          className="w-full"
          disabled={totalSelected < 2 || saving}
          onClick={handleSave}
        >
          {saving
            ? "Сохраняем..."
            : totalSelected < 2
              ? `Выбери ещё ${2 - totalSelected}`
              : "Готово"}
        </Button>
      </div>
    </div>
  );
}
