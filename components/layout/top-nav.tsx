"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, Search, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";
import { useCartStore, useFilterStore } from "@/lib/store";
import { FilterDrawer } from "@/components/layout/filter-drawer";
import { ru } from "@/lib/i18n/ru";
import { cn } from "@/lib/utils";

export function TopNav() {
  const [mounted, setMounted] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const searchQuery = useFilterStore((s) => s.searchQuery);
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery);
  const itemCount = useCartStore((state) => state.getItemCount());

  useEffect(() => {
    setMounted(true);
  }, []);

  const safeItemCount = mounted ? itemCount : 0;

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="relative flex h-14 items-center justify-between px-4">
          {/* Left - Menu/Filter Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setFilterOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/50 transition-colors hover:bg-secondary"
          >
            <Menu className="h-5 w-5" />
          </motion.button>

          {/* Center - Search bar */}
          <div className="absolute left-1/2 top-1/2 w-[calc(100%-7rem)] max-w-sm -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={ru.searchPlaceholder}
                className={cn(
                  "h-9 w-full rounded-full border border-border bg-secondary/50 pl-9 pr-3 text-sm",
                  "placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                )}
                aria-label={ru.searchPlaceholder}
              />
            </div>
          </div>

          {/* Right - Cart Icon */}
          <Link href="/cart" className="shrink-0">
            <motion.div
              whileTap={{ scale: 0.9 }}
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-secondary/50 transition-colors hover:bg-secondary"
            >
              <ShoppingBag className="h-5 w-5" />
              {safeItemCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
                >
                  {safeItemCount > 9 ? "9+" : safeItemCount}
                </motion.span>
              )}
            </motion.div>
          </Link>
        </div>
      </header>

      {/* Filter Drawer */}
      <FilterDrawer open={filterOpen} onOpenChange={setFilterOpen} />
    </>
  );
}
