"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { TopNav } from "@/components/layout/top-nav";
import { HeroSection } from "@/components/layout/hero-section";
import { InfiniteProductCarousel } from "@/components/products/infinite-product-carousel";
import { ProductGrid } from "@/components/products/product-grid";
import { InfiniteProductGrid } from "@/components/products/infinite-product-grid";
import { InfiniteFilterGrid } from "@/components/products/infinite-filter-grid";
import { SectionHeader } from "@/components/products/section-header";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { useFilterStore, useAdminStore, useTierStore } from "@/lib/store";
import { Product } from "@/lib/types";
import { client } from "@/lib/sanity/client";
import {
  hotDropsPaginatedQuery,
  saleProductsPaginatedQuery,
  freshArrivalsPaginatedQuery,
  productsByFilterQuery,
  productsByFilterCountQuery,
  searchProductsQuery,
  distinctSubtypesQuery,
} from "@/lib/sanity/queries";
import { cn } from "@/lib/utils";
import { buildSearchTerms } from "@/lib/search-utils";
import { ru } from "@/lib/i18n/ru";

// Fallback search filter for mock data
function filterBySearch(products: Product[], q: string): Product[] {
  const lower = q.toLowerCase().trim();
  if (!lower) return products;
  return products.filter((p) => {
    const title = (p.title || "").toLowerCase();
    const brandTitle =
      (typeof p.brand === "string" ? p.brand : p.brand?.title ?? "").toLowerCase();
    const description = (p.description || "").toLowerCase();
    return (
      title.includes(lower) ||
      brandTitle.includes(lower) ||
      description.includes(lower)
    );
  });
}

import { MOCK_PRODUCTS } from "@/lib/mock-data";

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
  // Use initial data from server for curated sections
  const [hotDrops, setHotDrops] = useState<Product[]>(initialHotDrops);
  const [saleProducts, setSaleProducts] = useState<Product[]>(initialSaleProducts);
  const [freshArrivals, setFreshArrivals] = useState<Product[]>(initialFreshArrivals);
  
  const [filteredProducts, setFilteredProducts] = useState<Product[] | null>(null);
  const [filteredCount, setFilteredCount] = useState(0);
  const [searchProducts, setSearchProducts] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [availableSubtypes, setAvailableSubtypes] = useState<string[]>([]);

  const { style, brand, category, subtype, setSubtype, saleOnly, searchQuery, hasActiveFilters, minPrice, maxPrice } = useFilterStore();
  const catalogInvalidated = useAdminStore((s) => s.catalogInvalidated);
  const tier = useTierStore((s) => s.tier);
  const filtersActive = hasActiveFilters();
  const searchActive = searchQuery.length >= 2;

  // Memoize filter params so the InfiniteFilterGrid can use them for paginated loading
  const filterParams = useMemo(() => ({
    saleOnly: !!saleOnly,
    style: style || "",
    brand: brand || "",
    category: category || "",
    subtype: subtype || "",
    minPrice: minPrice ?? 0,
    maxPrice: maxPrice ?? 999_999_999,
  }), [saleOnly, style, brand, category, subtype, minPrice, maxPrice]);

  // Sync curated sections if catalog changes or tier changes
  useEffect(() => {
    if (catalogInvalidated === 0 && tier === "ultimate") return;

    const fetchProducts = async () => {
      try {
        const [hotData, saleData, freshData] = await Promise.all([
          client.fetch(`*[_type == "product" && tier == $tier && isHotDrop == true && isOnSale != true] | order(_createdAt desc) [0...20] {
            _id, tier, title, slug, price, originalPrice, "images": images[].asset->url, "videos": videos[].asset->url, "model3d": model3d.asset->url, "category": category->{ _id, title, slug, subtypes }, "style": style->{ _id, title, slug }, "brand": brand->{ _id, title, slug }, subtype, sizes, colors, isHotDrop, isOnSale, isNewArrival
          }`, { tier }),
          client.fetch(`*[_type == "product" && tier == $tier && isOnSale == true] | order(_createdAt desc) [0...20] {
            _id, tier, title, slug, price, originalPrice, "images": images[].asset->url, "videos": videos[].asset->url, "model3d": model3d.asset->url, "category": category->{ _id, title, slug, subtypes }, "style": style->{ _id, title, slug }, "brand": brand->{ _id, title, slug }, subtype, sizes, colors, isHotDrop, isOnSale, isNewArrival
          }`, { tier }),
          client.fetch(`*[_type == "product" && tier == $tier && isNewArrival == true] | order(_createdAt desc) [0...20] {
             _id, tier, title, slug, price, originalPrice, "images": images[].asset->url, "videos": videos[].asset->url, "model3d": model3d.asset->url, "category": category->{ _id, title, slug, subtypes }, "style": style->{ _id, title, slug }, "brand": brand->{ _id, title, slug }, subtype, sizes, colors, isHotDrop, isOnSale, isNewArrival
          }`, { tier }),
        ]);

        setHotDrops(hotData || []);
        setSaleProducts(saleData || []);
        setFreshArrivals(freshData || []);
      } catch (error) {
        console.log("Client fetch error:", error);
      }
    };
    fetchProducts();
  }, [catalogInvalidated, tier]);

  // Fetch filtered products (first page only) + total count
  useEffect(() => {
    if (!filtersActive) {
      setFilteredProducts(null);
      setFilteredCount(0);
      return;
    }

    const fetchFiltered = async () => {
      setLoadingFilters(true);
      try {
        const [data, count] = await Promise.all([
          client.fetch(productsByFilterQuery, { tier, ...filterParams }),
          client.fetch(productsByFilterCountQuery, { tier, ...filterParams }),
        ]);

        setFilteredProducts(Array.isArray(data) ? data : []);
        setFilteredCount(typeof count === "number" ? count : 0);
      } catch (error) {
        console.log("Filter error:", error);
        let filtered = [...MOCK_PRODUCTS];
        if (saleOnly) filtered = filtered.filter((p) => p.isOnSale);
        if (style) filtered = filtered.filter((p) => p.style?.slug?.current === style || (typeof p.style === "string" && p.style === style));
        if (brand) filtered = filtered.filter((p) => p.brand?.slug?.current === brand || (typeof p.brand === "string" && p.brand === brand));
        if (category) filtered = filtered.filter((p) => p.category?.slug?.current === category);
        if (subtype) filtered = filtered.filter((p) => (p as { subtype?: string }).subtype === subtype);
        setFilteredProducts(filtered);
        setFilteredCount(filtered.length);
      }
      setLoadingFilters(false);
    };

    fetchFiltered();
  }, [style, brand, category, subtype, saleOnly, filtersActive, catalogInvalidated, tier, filterParams]);

  // Fetch distinct subtypes
  useEffect(() => {
    if (!filtersActive) {
      setAvailableSubtypes([]);
      return;
    }
    const fetchSubtypes = async () => {
      try {
        const data = await client.fetch(distinctSubtypesQuery, {
          tier,
          saleOnly: !!saleOnly,
          style: style || "",
          brand: brand || "",
          category: category || "",
          minPrice: minPrice ?? 0,
          maxPrice: maxPrice ?? 999_999_999,
        });
        const raw = Array.isArray(data) ? data : [];
        const subtypeCounts = new Map<string, number>();
        for (const p of raw) {
          const st = (p as { subtype?: string | null }).subtype;
          if (st && typeof st === 'string') subtypeCounts.set(st, (subtypeCounts.get(st) ?? 0) + 1);
        }
        const sorted = [...subtypeCounts.keys()].sort((a, b) => (subtypeCounts.get(b) ?? 0) - (subtypeCounts.get(a) ?? 0));
        setAvailableSubtypes(sorted);
      } catch {
        setAvailableSubtypes([]);
      }
    };
    fetchSubtypes();
  }, [filtersActive, style, brand, category, saleOnly, minPrice, maxPrice, catalogInvalidated, tier]);

  // Search: debounced fetch
  useEffect(() => {
    if (!searchActive) {
      setSearchProducts([]);
      return;
    }

    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const searchTerms = buildSearchTerms(searchQuery);
        if (searchTerms.length === 0) {
          setSearchProducts([]);
          setSearchLoading(false);
          return;
        }
        const data = await client.fetch(searchProductsQuery, { searchTerms, tier });
        const list = Array.isArray(data) ? data : [];
        setSearchProducts(list);
      } catch (error) {
        const filtered = filterBySearch(MOCK_PRODUCTS, searchQuery);
        setSearchProducts(filtered);
      }
      setSearchLoading(false);
    }, 300);

    return () => clearTimeout(t);
  }, [searchQuery, searchActive, tier]);

  return (
    <div className="min-h-screen">
      <TopNav />
      {searchActive ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-4">
          <SectionHeader eyebrow="SEARCH" title={ru.sectionSearchResults} />
          {searchLoading ? (
            <div className="grid grid-cols-2 gap-3 px-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-secondary" />
              ))}
            </div>
          ) : (() => {
            const displaySearch = saleOnly ? searchProducts.filter((p) => p.isOnSale) : searchProducts;
            return displaySearch.length === 0 ? (
              <p className="px-4 py-8 text-center text-muted-foreground">{ru.searchNoResults}</p>
            ) : (
              <>
                <p className="px-4 pb-3 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                  {ru.found ?? "Найдено"}: <span className="text-foreground font-bold">{displaySearch.length}</span>
                </p>
                <ProductGrid products={displaySearch} />
              </>
            );
          })()}
        </motion.div>
      ) : filtersActive ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-4">
          <SectionHeader eyebrow="FILTER" title={ru.sectionFilteredResults} />
          {(() => {
            const subtypeOptions = availableSubtypes;
            return (
              <>
                {subtypeOptions.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-2 px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {ru.subtypes}
                    </p>
                    <div className="flex gap-1.5 overflow-x-auto px-4 scrollbar-hide">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSubtype(null)}
                        className={cn(
                          "flex-shrink-0 rounded-full border px-2.5 py-1 text-xs transition-all whitespace-nowrap",
                          !subtype ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                        )}
                      >
                        {ru.viewAll}
                      </motion.button>
                      {subtypeOptions.map((st) => (
                        <motion.button
                          key={st}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSubtype(subtype === st ? null : st)}
                          className={cn(
                            "flex-shrink-0 rounded-full border px-2.5 py-1 text-xs transition-all whitespace-nowrap",
                            subtype === st ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                          )}
                        >
                          {st}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
                {loadingFilters ? (
                  <div className="grid grid-cols-2 gap-3 px-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="aspect-[3/4] skeleton" />
                    ))}
                  </div>
                ) : filteredProducts && filteredProducts.length === 0 ? (
                  <p className="px-4 py-8 text-center text-muted-foreground">{ru.searchNoResults}</p>
                ) : (
                  <InfiniteFilterGrid
                    initialProducts={filteredProducts || []}
                    filterParams={filterParams}
                    totalCount={filteredCount}
                  />
                )}
              </>
            );
          })()}
        </motion.div>
      ) : (
        <div className="space-y-2 py-2">
          <HeroSection />

          <SectionErrorBoundary>
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <SectionHeader eyebrow="TRENDING" title={ru.sectionHotDrops} />
              <InfiniteProductCarousel
                initialProducts={hotDrops}
                query={hotDropsPaginatedQuery}
                cardSize="large"
              />
            </motion.section>
          </SectionErrorBoundary>

          <SectionErrorBoundary>
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <SectionHeader eyebrow="SALE" title={ru.sectionSaleSteal} />
              <InfiniteProductCarousel
                initialProducts={saleProducts}
                query={saleProductsPaginatedQuery}
                showSalePrice
                cardSize="large"
              />
            </motion.section>
          </SectionErrorBoundary>

          <SectionErrorBoundary>
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <SectionHeader eyebrow="JUST IN" title={ru.sectionFreshArrivals} />
              <InfiniteProductGrid
                initialProducts={freshArrivals}
                query={freshArrivalsPaginatedQuery}
              />
            </motion.section>
          </SectionErrorBoundary>
        </div>
      )}
    </div>
  );
}
