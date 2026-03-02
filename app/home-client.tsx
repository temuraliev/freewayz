"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { TopNav } from "@/components/layout/top-nav";
import { ProductCarousel } from "@/components/products/product-carousel";
import { SectionHeader } from "@/components/products/section-header";
import { useFilterStore } from "@/lib/store";
import { Product, Category } from "@/lib/types";
import { client } from "@/lib/sanity/client";
import {
    productsByFilterQuery,
    searchProductsQuery,
    categoriesQuery,
} from "@/lib/sanity/queries";
import { cn } from "@/lib/utils";
import { ru } from "@/lib/i18n/ru";
import { sanitizeInput } from "@/lib/sanitize";
import { SortDropdown } from "@/components/products/sort-dropdown";
import { SortBy } from "@/lib/store/filter-store";
import { InfiniteProductGrid } from "@/components/products/infinite-product-grid";

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

export interface HomeInitialData {
    hotDrops: Product[];
    saleProducts: Product[];
    freshArrivals: Product[];
}

interface HomeClientProps {
    initialData: HomeInitialData;
}

export function HomeClient({ initialData }: HomeClientProps) {
    const [hotDrops] = useState<Product[]>(initialData.hotDrops);
    const [saleProducts] = useState<Product[]>(initialData.saleProducts);
    const [freshArrivals] = useState<Product[]>(initialData.freshArrivals);
    const [filteredProducts, setFilteredProducts] = useState<Product[] | null>(null);
    const [searchProducts, setSearchProducts] = useState<Product[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [filterLoading, setFilterLoading] = useState(false);
    const [categoriesForSubtypes, setCategoriesForSubtypes] = useState<Category[]>([]);

    const { style, brand, category, subtype, setSubtype, saleOnly, searchQuery, sortBy, priceMin, priceMax, hasActiveFilters } = useFilterStore();
    const filtersActive = hasActiveFilters();
    const searchActive = searchQuery.length >= 2;

    // Fetch filtered products when filters change
    useEffect(() => {
        if (!filtersActive) {
            setFilteredProducts(null);
            return;
        }

        const fetchFiltered = async () => {
            setFilterLoading(true);
            try {
                const data = await client.fetch(productsByFilterQuery, {
                    saleOnly: !!saleOnly,
                    style: style || "",
                    brand: brand || "",
                    category: category || "",
                    subtype: subtype || "",
                });
                setFilteredProducts(Array.isArray(data) ? data : []);
            } catch (error) {
                console.log("Filter error:", error);
                setFilteredProducts([]);
            }
            setFilterLoading(false);
        };

        fetchFiltered();
    }, [style, brand, category, subtype, saleOnly, filtersActive]);

    // Fetch categories for subtype chips
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

    // Search: debounced fetch
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
                setSearchProducts(filterBySearch(list, sanitizeInput(searchQuery)));
            } catch {
                setSearchProducts([]);
            }
            setSearchLoading(false);
        }, 300);

        return () => clearTimeout(t);
    }, [searchQuery, searchActive]);

    // ── Sort helper ─────────────────────────────────────────────
    const sortProducts = useCallback((products: Product[], by: SortBy): Product[] => {
        if (by === "default") return products;
        const sorted = [...products];
        switch (by) {
            case "price-asc":
                return sorted.sort((a, b) => a.price - b.price);
            case "price-desc":
                return sorted.sort((a, b) => b.price - a.price);
            case "name-asc":
                return sorted.sort((a, b) => a.title.localeCompare(b.title, "ru"));
            case "name-desc":
                return sorted.sort((a, b) => b.title.localeCompare(a.title, "ru"));
            case "newest":
                return sorted;
            default:
                return sorted;
        }
    }, []);

    // ── Price filter helper ─────────────────────────────────────
    const filterByPrice = useCallback((products: Product[]): Product[] => {
        if (priceMin == null && priceMax == null) return products;
        return products.filter((p) => {
            if (priceMin != null && p.price < priceMin) return false;
            if (priceMax != null && p.price > priceMax) return false;
            return true;
        });
    }, [priceMin, priceMax]);

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

    const GridSkeleton = () => (
        <div className="grid grid-cols-2 gap-3 px-4">
            {[...Array(4)].map((_, i) => (
                <div
                    key={i}
                    className="aspect-[3/4] animate-pulse rounded-xl bg-secondary"
                />
            ))}
        </div>
    );

    return (
        <div className="min-h-screen">
            <TopNav />

            {searchActive ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-4"
                >
                    <SectionHeader title={ru.sectionSearchResults} emoji="🔍" />
                    <div className="mb-3">
                        <SortDropdown />
                    </div>
                    {searchLoading ? (
                        <GridSkeleton />
                    ) : (() => {
                        let display = saleOnly
                            ? searchProducts.filter((p) => p.isOnSale)
                            : searchProducts;
                        display = filterByPrice(display);
                        display = sortProducts(display, sortBy);
                        return display.length === 0 ? (
                            <p className="px-4 py-8 text-center text-muted-foreground">
                                {ru.searchNoResults}
                            </p>
                        ) : (
                            <InfiniteProductGrid products={display} totalCount={display.length} />
                        );
                    })()}
                </motion.div>
            ) : filtersActive ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-4"
                >
                    <SectionHeader title={ru.sectionFilteredResults} emoji="🔍" />
                    <div className="mb-3">
                        <SortDropdown />
                    </div>
                    {(() => {
                        const selectedCategory = categoriesForSubtypes.find((c) => c.slug?.current === category);
                        const subtypeOptions = selectedCategory?.subtypes ?? [];
                        const processed = sortProducts(filterByPrice(filteredProducts || []), sortBy);

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
                                {filterLoading ? (
                                    <GridSkeleton />
                                ) : (
                                    <InfiniteProductGrid products={processed} totalCount={processed.length} />
                                )}
                            </>
                        );
                    })()}
                </motion.div>
            ) : (
                <div className="space-y-6 py-4">
                    {/* Section 1: Hot Drops */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <SectionHeader title={ru.sectionHotDrops} emoji="🔥" />
                        <ProductCarousel products={hotDrops} cardSize="large" />
                    </motion.section>

                    {/* Section 2: Sale */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <SectionHeader title={ru.sectionSaleSteal} emoji="💸" />
                        <ProductCarousel products={saleProducts} showSalePrice cardSize="large" />
                    </motion.section>

                    {/* Section 3: Fresh Arrivals */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <SectionHeader title={ru.sectionFreshArrivals} emoji="🆕" />
                        <InfiniteProductGrid products={freshArrivals} totalCount={freshArrivals.length} />
                    </motion.section>
                </div>
            )}
        </div>
    );
}
