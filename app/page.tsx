"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TopNav } from "@/components/layout/top-nav";
import { HeroSection } from "@/components/layout/hero-section";
import { ProductCarousel } from "@/components/products/product-carousel";
import { ProductGrid } from "@/components/products/product-grid";
import { InfiniteProductGrid } from "@/components/products/infinite-product-grid";
import { SectionHeader } from "@/components/products/section-header";
import { useFilterStore } from "@/lib/store";
import { Product, Category } from "@/lib/types";
import { client } from "@/lib/sanity/client";
import {
  hotDropsQuery,
  hotDropsPaginatedQuery,
  saleProductsQuery,
  freshArrivalsQuery,
  freshArrivalsPaginatedQuery,
  productsByFilterQuery,
  searchProductsQuery,
  categoriesQuery,
} from "@/lib/sanity/queries";
import { cn } from "@/lib/utils";
import { ru } from "@/lib/i18n/ru";

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

export default function HomePage() {
  const [hotDrops, setHotDrops] = useState<Product[]>([]);
  const [saleProducts, setSaleProducts] = useState<Product[]>([]);
  const [freshArrivals, setFreshArrivals] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[] | null>(null);
  const [searchProducts, setSearchProducts] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categoriesForSubtypes, setCategoriesForSubtypes] = useState<Category[]>([]);

  const { style, brand, category, subtype, setSubtype, saleOnly, searchQuery, hasActiveFilters, minPrice, maxPrice } = useFilterStore();
  const filtersActive = hasActiveFilters();
  const searchActive = searchQuery.length >= 2;

  // Fetch curated sections
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);

      try {
        // Try fetching from Sanity
        const [hotData, saleData, freshData] = await Promise.all([
          client.fetch(hotDropsQuery),
          client.fetch(saleProductsQuery),
          client.fetch(freshArrivalsQuery),
        ]);

        // If Sanity succeeds, we trust its response (even if empty)
        setHotDrops(hotData || []);
        setSaleProducts(saleData || []);
        setFreshArrivals(freshData || []);
      } catch (error) {
        console.log("Using mock data:", error);
        setHotDrops(MOCK_PRODUCTS.filter((p) => p.isHotDrop && !p.isOnSale));
        setSaleProducts(MOCK_PRODUCTS.filter((p) => p.isOnSale));
        setFreshArrivals(MOCK_PRODUCTS);
      }

      setLoading(false);
    };

    fetchProducts();
  }, []);

  // Fetch filtered products when filters change
  useEffect(() => {
    if (!filtersActive) {
      setFilteredProducts(null);
      return;
    }

    const fetchFiltered = async () => {
      setLoading(true);
      try {
        const data = await client.fetch(productsByFilterQuery, {
          saleOnly: !!saleOnly,
          style: style || "",
          brand: brand || "",
          category: category || "",
          subtype: subtype || "",
          minPrice: minPrice ?? 0,
          maxPrice: maxPrice ?? 999_999_999,
        });

        // Only trust data if it's an array. If empty, the filter matched nothing.
        if (Array.isArray(data)) {
          setFilteredProducts(data);
        } else {
          setFilteredProducts([]);
        }
      } catch (error) {
        console.log("Filter error:", error);
        let filtered = [...MOCK_PRODUCTS];
        if (saleOnly) filtered = filtered.filter((p) => p.isOnSale);
        if (style) filtered = filtered.filter((p) => p.style?.slug?.current === style || (typeof p.style === "string" && p.style === style));
        if (brand) filtered = filtered.filter((p) => p.brand?.slug?.current === brand || (typeof p.brand === "string" && p.brand === brand));
        if (category) filtered = filtered.filter((p) => p.category?.slug?.current === category);
        if (subtype) filtered = filtered.filter((p) => (p as { subtype?: string }).subtype === subtype);
        setFilteredProducts(filtered);
      }

      setLoading(false);
    };

    fetchFiltered();
  }, [style, brand, category, subtype, saleOnly, filtersActive]);

  // Fetch categories (for subtype chips) when viewing filtered results with a category
  useEffect(() => {
    if (!filtersActive || !category) {
      setCategoriesForSubtypes([]);
      return;
    }
    const fetchCategories = async () => {
      try {
        const data = await client.fetch(categoriesQuery);
        setCategoriesForSubtypes(Array.isArray(data) ? data : []);
      } catch {
        setCategoriesForSubtypes([]);
      }
    };
    fetchCategories();
  }, [filtersActive, category]);

  // Search: debounced fetch and filter by title/brand
  useEffect(() => {
    if (!searchActive) {
      setSearchProducts([]);
      return;
    }

    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await client.fetch(searchProductsQuery);
        const list = Array.isArray(data) ? data : [];
        const filtered = filterBySearch(list, searchQuery);
        setSearchProducts(filtered);
      } catch (error) {
        const filtered = filterBySearch(MOCK_PRODUCTS, searchQuery);
        setSearchProducts(filtered);
      }
      setSearchLoading(false);
    }, 300);

    return () => clearTimeout(t);
  }, [searchQuery, searchActive]);

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="flex gap-3 overflow-hidden px-4">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="w-[160px] flex-shrink-0 animate-pulse rounded-xl bg-secondary"
          style={{ aspectRatio: "3/4" }}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen">
      <TopNav />

      {/* Show search results / filtered results / curated sections */}
      {searchActive ? (
        // Search Results View
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-4"
        >
          <SectionHeader eyebrow="SEARCH" title={ru.sectionSearchResults} />
          {searchLoading ? (
            <div className="grid grid-cols-2 gap-3 px-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-secondary" />
              ))}
            </div>
          ) : (() => {
            const displaySearch = saleOnly
              ? searchProducts.filter((p) => p.isOnSale)
              : searchProducts;
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
        // Filtered Products View (with subtype chips when category has subtypes)
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-4"
        >
          <SectionHeader eyebrow="FILTER" title={ru.sectionFilteredResults} />
          {(() => {
            const selectedCategory = categoriesForSubtypes.find((c) => c.slug?.current === category);
            const subtypeOptions = selectedCategory?.subtypes ?? [];
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
                          !subtype
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-secondary/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground"
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
                            subtype === st
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-secondary/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                          )}
                        >
                          {st}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
                {loading ? (
                  <div className="grid grid-cols-2 gap-3 px-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="aspect-[3/4] skeleton" />
                    ))}
                  </div>
                ) : filteredProducts && filteredProducts.length === 0 ? (
                  <p className="px-4 py-8 text-center text-muted-foreground">{ru.searchNoResults}</p>
                ) : (
                  <>
                    {filteredProducts && filteredProducts.length > 0 && (
                      <p className="px-4 pb-3 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                        {ru.found ?? "Найдено"}: <span className="text-foreground font-bold">{filteredProducts.length}</span>
                      </p>
                    )}
                    <ProductGrid products={filteredProducts || []} />
                  </>
                )}
              </>
            );
          })()}
        </motion.div>
      ) : (
        // Curated Sections View
        <div className="space-y-2 py-2">
          {/* Editorial Hero */}
          <HeroSection />

          {/* Section 1: Hot Drops */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <SectionHeader eyebrow="TRENDING" title={ru.sectionHotDrops} />
            {loading ? (
              <LoadingSkeleton />
            ) : (
              <ProductCarousel products={hotDrops} cardSize="large" />
            )}
          </motion.section>

          {/* Section 2: Sale / Steal */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <SectionHeader eyebrow="SALE" title={ru.sectionSaleSteal} />
            {loading ? (
              <LoadingSkeleton />
            ) : (
              <ProductCarousel products={saleProducts} showSalePrice cardSize="large" />
            )}
          </motion.section>

          {/* Section 3: Fresh Arrivals */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <SectionHeader eyebrow="JUST IN" title={ru.sectionFreshArrivals} />
            {loading ? (
              <div className="grid grid-cols-2 gap-3 px-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="aspect-[3/4] skeleton" />
                ))}
              </div>
            ) : (
              <InfiniteProductGrid
                initialProducts={freshArrivals}
                query={freshArrivalsPaginatedQuery}
              />
            )}
          </motion.section>
        </div>
      )}
    </div>
  );
}
