"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@frontend/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@frontend/components/ui/accordion";
import { Button } from "@frontend/components/ui/button";
import { useFilterStore } from "@frontend/stores";
import { cn } from "@shared/utils";
import { ru } from "@shared/i18n/ru";
import { PriceRangeSlider } from "@frontend/components/products/price-range-slider";
import { useFilterData } from "./use-filter-data";
import { FilterChip } from "./filter-chip";

const PRICE_MIN = 0;
const PRICE_MAX = 15_000_000;

interface FilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FilterDrawer({ open, onOpenChange }: FilterDrawerProps) {
  const {
    style, brand, category, subtype, saleOnly, minPrice, maxPrice,
    setStyle, setBrand, setCategory, setSubtype, setSaleOnly, setPriceRange, clearFilters,
  } = useFilterStore();

  const { categories, styles, brands } = useFilterData();

  // Local (temp) state — only committed on Apply
  const [tempStyle, setTempStyle] = useState<string | null>(style);
  const [tempBrand, setTempBrand] = useState<string | null>(brand);
  const [tempCategory, setTempCategory] = useState<string | null>(category);
  const [tempSubtype, setTempSubtype] = useState<string | null>(subtype);
  const [tempSaleOnly, setTempSaleOnly] = useState<boolean>(saleOnly);
  const [tempMinPrice, setTempMinPrice] = useState<number | null>(minPrice);
  const [tempMaxPrice, setTempMaxPrice] = useState<number | null>(maxPrice);

  // Sync temp state when drawer opens
  useEffect(() => {
    if (open) {
      setTempStyle(style);
      setTempBrand(brand);
      setTempCategory(category);
      setTempSubtype(subtype);
      setTempSaleOnly(saleOnly);
      setTempMinPrice(minPrice);
      setTempMaxPrice(maxPrice);
    }
  }, [open, style, brand, category, subtype, saleOnly, minPrice, maxPrice]);

  const handleApply = () => {
    setStyle(tempStyle);
    setBrand(tempBrand);
    setCategory(tempCategory);
    setSubtype(tempSubtype);
    setSaleOnly(tempSaleOnly);
    setPriceRange(tempMinPrice, tempMaxPrice);
    onOpenChange(false);
  };

  const handleClear = () => {
    setTempStyle(null);
    setTempBrand(null);
    setTempCategory(null);
    setTempSubtype(null);
    setTempSaleOnly(false);
    setTempMinPrice(null);
    setTempMaxPrice(null);
    clearFilters();
  };

  const hasPriceFilter = tempMinPrice !== null || tempMaxPrice !== null;
  const activeFilterCount =
    [tempStyle, tempBrand, tempCategory, tempSubtype].filter(Boolean).length +
    (tempSaleOnly ? 1 : 0) +
    (hasPriceFilter ? 1 : 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex flex-col overflow-hidden">
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle className="flex items-center gap-2 font-headline text-lg tracking-wider">
            <SlidersHorizontal className="h-5 w-5" />
            {ru.filters}
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Sale only toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-4 py-3">
            <span className="text-sm font-medium">{ru.saleOnly}</span>
            <button
              type="button"
              role="switch"
              aria-checked={tempSaleOnly}
              onClick={() => setTempSaleOnly(!tempSaleOnly)}
              className={cn(
                "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                tempSaleOnly ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition",
                  tempSaleOnly ? "translate-x-5" : "translate-x-1"
                )}
              />
            </button>
          </div>

          {/* Price Range */}
          <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {ru.priceRange ?? "Цена"}
              </span>
              {hasPriceFilter && (
                <button
                  onClick={() => { setTempMinPrice(null); setTempMaxPrice(null); }}
                  className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  Сбросить
                </button>
              )}
            </div>
            <PriceRangeSlider
              min={PRICE_MIN}
              max={PRICE_MAX}
              step={100_000}
              valueMin={tempMinPrice}
              valueMax={tempMaxPrice}
              onChange={(min, max) => {
                setTempMinPrice(min);
                setTempMaxPrice(max);
              }}
            />
          </div>

          <Accordion type="multiple" defaultValue={["categories", "styles", "brands"]} className="w-full">
            {/* Categories */}
            <AccordionItem value="categories">
              <AccordionTrigger className="text-sm font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                {ru.categories}
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-2">
                  {categories.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {ru.noCategoriesYet} <span className="font-mono">{ru.studio}</span>.
                    </p>
                  )}
                  {categories.map((cat) => (
                    <FilterChip
                      key={cat._id}
                      label={cat.title}
                      active={tempCategory === cat.slug?.current}
                      onClick={() => {
                        const next = tempCategory === cat.slug?.current ? null : (cat.slug?.current ?? null);
                        setTempCategory(next);
                        if (next !== tempCategory) setTempSubtype(null);
                      }}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Styles */}
            <AccordionItem value="styles">
              <AccordionTrigger className="text-sm font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                {ru.styles}
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-2">
                  {styles.map((s) => (
                    <FilterChip
                      key={s._id}
                      label={s.title}
                      active={tempStyle === s.slug.current}
                      onClick={() => setTempStyle(tempStyle === s.slug.current ? null : s.slug.current)}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Brands */}
            <AccordionItem value="brands">
              <AccordionTrigger className="text-sm font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                {ru.brands}
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-2">
                  {brands.map((b) => (
                    <FilterChip
                      key={b._id}
                      label={b.title}
                      active={tempBrand === b.slug.current}
                      onClick={() => setTempBrand(tempBrand === b.slug.current ? null : b.slug.current)}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Footer */}
        <div className="border-t border-border pt-4 space-y-3">
          {activeFilterCount > 0 && (
            <button
              onClick={handleClear}
              className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
              {ru.clearAllFilters}
            </button>
          )}
          <Button onClick={handleApply} className="w-full" size="lg">
            {ru.applyFilters}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
