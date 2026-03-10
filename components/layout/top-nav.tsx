"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, ShoppingBag, SlidersHorizontal, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore, useFilterStore, useAdminStore, useTierStore } from "@/lib/store";
import { FilterDrawer } from "@/components/layout/filter-drawer";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";

export function TopNav() {
  const [mounted, setMounted] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchQuery = useFilterStore((s) => s.searchQuery);
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery);
  const itemCount = useCartStore((state) => state.getItemCount());
  const isAdmin = useAdminStore((s) => s.isAdmin);
  const tier = useTierStore((s) => s.tier);
  const toggleTier = useTierStore((s) => s.toggleTier);

  useEffect(() => { setMounted(true); }, []);
  const safeItemCount = mounted ? itemCount : 0;

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-3 px-4">

          {/* Tier toggle */}
          {mounted && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={toggleTier}
              className={cn(
                "relative flex h-7 shrink-0 items-center overflow-hidden border text-[9px] font-extrabold uppercase tracking-[0.14em] transition-all duration-300",
                tier === "ultimate"
                  ? "border-amber-500/50 bg-gradient-to-r from-amber-500/15 to-yellow-500/10"
                  : "border-border bg-secondary/40"
              )}
              style={{ borderRadius: "2px", minWidth: "88px" }}
            >
              <motion.div
                className={cn(
                  "absolute inset-y-0 w-1/2 transition-colors duration-300",
                  tier === "ultimate"
                    ? "bg-gradient-to-r from-amber-500 to-yellow-500"
                    : "bg-foreground"
                )}
                animate={{ x: tier === "ultimate" ? "100%" : "0%" }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                style={{ borderRadius: "1px" }}
              />
              <span
                className={cn(
                  "relative z-10 flex-1 text-center transition-colors duration-200",
                  tier === "top" ? "text-background" : "text-muted-foreground"
                )}
              >
                TOP
              </span>
              <span
                className={cn(
                  "relative z-10 flex-1 text-center transition-colors duration-200",
                  tier === "ultimate" ? "text-background" : "text-muted-foreground"
                )}
              >
                ULT
              </span>
            </motion.button>
          )}

          {/* Search bar */}
          <div className="relative flex-1">
            <Search
              className={cn(
                "absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-colors duration-200 pointer-events-none",
                searchFocused ? "text-foreground" : "text-muted-foreground"
              )}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={ru.searchPlaceholder}
              className={cn(
                "h-9 w-full border bg-secondary/40 pl-8.5 pr-3 text-[13px]",
                "placeholder:text-muted-foreground/60 focus:outline-none transition-colors duration-200",
                searchFocused
                  ? "border-foreground/40 bg-secondary/70"
                  : "border-border",
                "rounded-none" // sharp corners for editorial feel
              )}
              style={{ paddingLeft: "2rem" }}
              aria-label={ru.searchPlaceholder}
            />
          </div>

          {/* Filter button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setFilterOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-border bg-secondary/40 transition-colors hover:bg-secondary"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </motion.button>

          {/* Cart */}
          <Link href="/cart" className="shrink-0">
            <motion.div
              whileTap={{ scale: 0.9 }}
              className="relative flex h-9 w-9 items-center justify-center border border-border bg-secondary/40 transition-colors hover:bg-secondary"
            >
              <ShoppingBag className="h-4 w-4" />
              <AnimatePresence>
                {safeItemCount > 0 && (
                  <motion.span
                    key="badge"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="absolute -right-1.5 -top-1.5 flex h-4.5 w-4.5 items-center justify-center bg-foreground text-[9px] font-extrabold text-background"
                    style={{ width: "18px", height: "18px", borderRadius: "1px" }}
                  >
                    {safeItemCount > 9 ? "9+" : safeItemCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          </Link>

          {/* Admin panel — только для админов */}
          {mounted && isAdmin === true && (
            <Link href="/admin" className="shrink-0" title="Админ-панель">
              <motion.div
                whileTap={{ scale: 0.9 }}
                className="flex h-9 w-9 items-center justify-center border border-amber-500/40 bg-amber-500/10 transition-colors hover:bg-amber-500/20"
              >
                <Shield className="h-4 w-4 text-amber-500" />
              </motion.div>
            </Link>
          )}
        </div>
      </header>

      <FilterDrawer open={filterOpen} onOpenChange={setFilterOpen} />
    </>
  );
}
