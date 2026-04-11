"use client";

import { useFilterStore } from "@frontend/stores";
import { Style, Brand } from "@shared/types";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@shared/utils";
import { ru } from "@shared/i18n/ru";

const STYLES: Style[] = [
  { _id: "opium", title: "Opium", slug: { current: "opium" } },
  { _id: "old-money", title: "Old Money", slug: { current: "old-money" } },
  { _id: "uk-drill", title: "UK Drill", slug: { current: "uk-drill" } },
  { _id: "y2k", title: "Y2K", slug: { current: "y2k" } },
  { _id: "gorpcore", title: "Gorpcore", slug: { current: "gorpcore" } },
];

const BRANDS: Brand[] = [
  { _id: "mertra", title: "Mertra", slug: { current: "mertra" } },
  { _id: "hellstar", title: "Hellstar", slug: { current: "hellstar" } },
  { _id: "corteiz", title: "Corteiz", slug: { current: "corteiz" } },
  { _id: "rick-owens", title: "Rick Owens", slug: { current: "rick-owens" } },
  { _id: "balenciaga", title: "Balenciaga", slug: { current: "balenciaga" } },
  { _id: "chrome-hearts", title: "Chrome Hearts", slug: { current: "chrome-hearts" } },
  { _id: "gallery-dept", title: "Gallery Dept", slug: { current: "gallery-dept" } },
];

export function FilterBar() {
  const { style, brand, setStyle, setBrand, clearFilters, hasActiveFilters } =
    useFilterStore();

  return (
    <div className="space-y-3 py-4">
      {/* Active Filters Clear Button */}
      <AnimatePresence>
        {hasActiveFilters() && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4"
          >
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              {ru.clearAllFilters}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Styles Filter */}
      <div className="space-y-2">
        <h3 className="px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {ru.styles}
        </h3>
        <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4">
          {STYLES.map((s) => (
            <button
              key={s._id}
              onClick={() => setStyle(style === s.slug.current ? null : s.slug.current)}
              className={cn(
                "filter-chip whitespace-nowrap",
                style === s.slug.current && "active"
              )}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Brands Filter */}
      <div className="space-y-2">
        <h3 className="px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {ru.brands}
        </h3>
        <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4">
          {BRANDS.map((b) => (
            <button
              key={b._id}
              onClick={() => setBrand(brand === b.slug.current ? null : b.slug.current)}
              className={cn(
                "filter-chip whitespace-nowrap",
                brand === b.slug.current && "active"
              )}
            >
              {b.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
