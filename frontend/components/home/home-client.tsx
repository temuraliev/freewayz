"use client";

import { motion } from "framer-motion";
import { TopNav } from "@frontend/components/layout/top-nav";
import { HeroSection } from "@frontend/components/layout/hero-section";
import { InfiniteProductCarousel } from "@frontend/components/products/infinite-product-carousel";
import { ProductGrid } from "@frontend/components/products/product-grid";
import { InfiniteProductGrid } from "@frontend/components/products/infinite-product-grid";
import { InfiniteFilterGrid } from "@frontend/components/products/infinite-filter-grid";
import { SectionHeader } from "@frontend/components/products/section-header";
import { SectionErrorBoundary } from "@frontend/components/ui/section-error-boundary";
import { useFilterStore } from "@frontend/stores";
import { Product } from "@shared/types";
import {
  hotDropsPaginatedQuery,
  saleProductsPaginatedQuery,
  freshArrivalsPaginatedQuery,
} from "@shared/sanity/queries";
import { cn } from "@shared/utils";
import { ru } from "@shared/i18n/ru";

import { useCuratedSections } from "./use-curated-sections";
import { useFilteredProducts } from "./use-filtered-products";
import { useSearchProducts } from "./use-search-products";
import { useSubtypes } from "./use-subtypes";

interface HomeClientProps {
  initialHotDrops: Product[];
  initialSaleProducts: Product[];
  initialFreshArrivals: Product[];
}

export function HomeClient({
  initialHotDrops,
  initialSaleProducts,
  initialFreshArrivals,
}: HomeClientProps) {
  const { subtype, setSubtype } = useFilterStore();

  const { hotDrops, saleProducts, freshArrivals } = useCuratedSections({
    hotDrops: initialHotDrops,
    saleProducts: initialSaleProducts,
    freshArrivals: initialFreshArrivals,
  });

  const { filteredProducts, filteredCount, loading: loadingFilters, filterParams, filtersActive } =
    useFilteredProducts();
  const { searchProducts, searchActive, loading: searchLoading } = useSearchProducts();
  const availableSubtypes = useSubtypes();

  return (
    <div className="min-h-screen">
      <TopNav />

      {searchActive ? (
        <SearchView products={searchProducts} loading={searchLoading} />
      ) : filtersActive ? (
        <FilterView
          products={filteredProducts}
          count={filteredCount}
          loading={loadingFilters}
          filterParams={filterParams}
          subtypes={availableSubtypes}
          activeSubtype={subtype}
          onSubtypeChange={setSubtype}
        />
      ) : (
        <CuratedView
          hotDrops={hotDrops}
          saleProducts={saleProducts}
          freshArrivals={freshArrivals}
        />
      )}
    </div>
  );
}

// ── Search results view ─────────────────────────────────────

function SearchView({ products, loading }: { products: Product[]; loading: boolean }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-4">
      <SectionHeader eyebrow="SEARCH" title={ru.sectionSearchResults} />
      {loading ? (
        <SkeletonGrid />
      ) : products.length === 0 ? (
        <p className="px-4 py-8 text-center text-muted-foreground">{ru.searchNoResults}</p>
      ) : (
        <>
          <p className="px-4 pb-3 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            {ru.found ?? "Найдено"}: <span className="text-foreground font-bold">{products.length}</span>
          </p>
          <ProductGrid products={products} />
        </>
      )}
    </motion.div>
  );
}

// ── Filtered results view ───────────────────────────────────

function FilterView({
  products,
  count,
  loading,
  filterParams,
  subtypes,
  activeSubtype,
  onSubtypeChange,
}: {
  products: Product[] | null;
  count: number;
  loading: boolean;
  filterParams: {
    saleOnly: boolean;
    style: string;
    brand: string;
    category: string;
    subtype: string;
    minPrice: number;
    maxPrice: number;
  };
  subtypes: string[];
  activeSubtype: string | null;
  onSubtypeChange: (s: string | null) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-4">
      <SectionHeader eyebrow="FILTER" title={ru.sectionFilteredResults} />

      {subtypes.length > 0 && (
        <div className="mb-3">
          <p className="mb-2 px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {ru.subtypes}
          </p>
          <div className="flex gap-1.5 overflow-x-auto px-4 scrollbar-hide">
            <SubtypeChip label={ru.viewAll} active={!activeSubtype} onClick={() => onSubtypeChange(null)} />
            {subtypes.map((st) => (
              <SubtypeChip
                key={st}
                label={st}
                active={activeSubtype === st}
                onClick={() => onSubtypeChange(activeSubtype === st ? null : st)}
              />
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonGrid />
      ) : products && products.length === 0 ? (
        <p className="px-4 py-8 text-center text-muted-foreground">{ru.searchNoResults}</p>
      ) : (
        <InfiniteFilterGrid
          initialProducts={products || []}
          filterParams={filterParams}
          totalCount={count}
        />
      )}
    </motion.div>
  );
}

// ── Curated sections view ───────────────────────────────────

function CuratedView({
  hotDrops,
  saleProducts,
  freshArrivals,
}: {
  hotDrops: Product[];
  saleProducts: Product[];
  freshArrivals: Product[];
}) {
  return (
    <div className="space-y-2 py-2">
      <HeroSection />

      <SectionErrorBoundary>
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <SectionHeader eyebrow="TRENDING" title={ru.sectionHotDrops} />
          <InfiniteProductCarousel initialProducts={hotDrops} query={hotDropsPaginatedQuery} cardSize="large" />
        </motion.section>
      </SectionErrorBoundary>

      <SectionErrorBoundary>
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <SectionHeader eyebrow="SALE" title={ru.sectionSaleSteal} />
          <InfiniteProductCarousel initialProducts={saleProducts} query={saleProductsPaginatedQuery} showSalePrice cardSize="large" />
        </motion.section>
      </SectionErrorBoundary>

      <SectionErrorBoundary>
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <SectionHeader eyebrow="JUST IN" title={ru.sectionFreshArrivals} />
          <InfiniteProductGrid initialProducts={freshArrivals} query={freshArrivalsPaginatedQuery} />
        </motion.section>
      </SectionErrorBoundary>
    </div>
  );
}

// ── Shared UI pieces ─────────────────��──────────────────────

function SubtypeChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "flex-shrink-0 rounded-full border px-2.5 py-1 text-xs transition-all whitespace-nowrap",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-secondary/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </motion.button>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 px-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-secondary" />
      ))}
    </div>
  );
}
