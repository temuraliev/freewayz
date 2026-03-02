"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { TopNav } from "@/components/layout/top-nav";
import { ProductCarousel } from "@/components/products/product-carousel";
import { ProductGrid } from "@/components/products/product-grid";
import { SectionHeader } from "@/components/products/section-header";
import { useFilterStore } from "@/lib/store";
import { Product, Category } from "@/lib/types";
import { client } from "@/lib/sanity/client";
import {
  hotDropsQuery,
  saleProductsQuery,
  freshArrivalsQuery,
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

// Mock products for development/demo (style/brand as refs)
const mockStyle = (title: string, slug: string) => ({ _id: slug, title, slug: { current: slug } });
const mockBrand = (title: string, slug: string) => ({ _id: slug, title, slug: { current: slug } });
const MOCK_PRODUCTS: Product[] = [
  {
    _id: "1",
    title: "Washed Black Hoodie",
    slug: { current: "washed-black-hoodie" },
    price: 280,
    images: ["https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80"],
    category: { title: "Hoodies", slug: { current: "hoodies" } },
    style: mockStyle("Opium", "opium"),
    brand: mockBrand("Hellstar", "hellstar"),
    sizes: ["S", "M", "L", "XL"],
    colors: ["Black"],
    isHotDrop: true,
  },
  {
    _id: "2",
    title: "Distressed Cargo Pants",
    slug: { current: "distressed-cargo-pants" },
    price: 320,
    originalPrice: 420,
    images: ["https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80"],
    category: { title: "Pants", slug: { current: "pants" } },
    style: mockStyle("UK Drill", "uk-drill"),
    brand: mockBrand("Corteiz", "corteiz"),
    sizes: ["S", "M", "L"],
    colors: ["Black", "Grey"],
    isOnSale: true,
  },
  {
    _id: "3",
    title: "Oversized Graphic Tee",
    slug: { current: "oversized-graphic-tee" },
    price: 180,
    images: ["https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&q=80"],
    category: { title: "T-Shirts", slug: { current: "t-shirts" } },
    style: mockStyle("Y2K", "y2k"),
    brand: mockBrand("Gallery Dept", "gallery-dept"),
    sizes: ["M", "L", "XL", "XXL"],
    colors: ["White", "Black"],
    isHotDrop: true,
  },
  {
    _id: "4",
    title: "Leather Platform Boots",
    slug: { current: "leather-platform-boots" },
    price: 890,
    originalPrice: 1200,
    images: ["https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=800&q=80"],
    category: { title: "Footwear", slug: { current: "footwear" } },
    style: mockStyle("Opium", "opium"),
    brand: mockBrand("Rick Owens", "rick-owens"),
    sizes: ["S", "M", "L"],
    colors: ["Black"],
    isOnSale: true,
  },
  {
    _id: "5",
    title: "Cashmere Knit Sweater",
    slug: { current: "cashmere-knit-sweater" },
    price: 650,
    images: ["https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800&q=80"],
    category: { title: "Knitwear", slug: { current: "knitwear" } },
    style: mockStyle("Old Money", "old-money"),
    brand: mockBrand("Represent", "represent"),
    sizes: ["S", "M", "L", "XL"],
    colors: ["Cream", "Grey", "Navy"],
    isHotDrop: true,
  },
  {
    _id: "6",
    title: "Technical Windbreaker",
    slug: { current: "technical-windbreaker" },
    price: 380,
    images: ["https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=80"],
    category: { title: "Outerwear", slug: { current: "outerwear" } },
    style: mockStyle("Gorpcore", "gorpcore"),
    brand: mockBrand("Balenciaga", "balenciaga"),
    sizes: ["M", "L", "XL"],
    colors: ["Black", "Navy"],
  },
  {
    _id: "7",
    title: "Chrome Hearts Jeans",
    slug: { current: "chrome-hearts-jeans" },
    price: 690,
    originalPrice: 890,
    images: ["https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=80"],
    category: { title: "Pants", slug: { current: "pants" } },
    style: mockStyle("Opium", "opium"),
    brand: mockBrand("Chrome Hearts", "chrome-hearts"),
    sizes: ["S", "M", "L"],
    colors: ["Black", "Grey"],
    isOnSale: true,
  },
  {
    _id: "8",
    title: "Vintage Bomber Jacket",
    slug: { current: "vintage-bomber-jacket" },
    price: 520,
    images: ["https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80"],
    category: { title: "Outerwear", slug: { current: "outerwear" } },
    style: mockStyle("Old Money", "old-money"),
    brand: mockBrand("Amiri", "amiri"),
    sizes: ["S", "M", "L", "XL"],
    colors: ["Black", "Brown"],
  },
];

export default function HomePage() {
  const [hotDrops, setHotDrops] = useState<Product[]>([]);
  const [saleProducts, setSaleProducts] = useState<Product[]>([]);
  const [freshArrivals, setFreshArrivals] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[] | null>(null);
  const [searchProducts, setSearchProducts] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categoriesForSubtypes, setCategoriesForSubtypes] = useState<Category[]>([]);

  const { style, brand, category, subtype, setSubtype, saleOnly, searchQuery, hasActiveFilters } = useFilterStore();
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

        // Use mock data if Sanity returns empty (Hot Drops exclude sale items)
        setHotDrops(
          hotData?.length > 0
            ? hotData
            : MOCK_PRODUCTS.filter((p) => p.isHotDrop && !p.isOnSale)
        );
        setSaleProducts(
          saleData?.length > 0 ? saleData : MOCK_PRODUCTS.filter((p) => p.isOnSale)
        );
        setFreshArrivals(freshData?.length > 0 ? freshData : MOCK_PRODUCTS);
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
        });

        if (data && data.length > 0) {
          setFilteredProducts(data);
        } else {
          let filtered = [...MOCK_PRODUCTS];
          if (saleOnly) filtered = filtered.filter((p) => p.isOnSale);
          if (style) filtered = filtered.filter((p) => p.style?.slug?.current === style || (typeof p.style === "string" && p.style === style));
          if (brand) filtered = filtered.filter((p) => p.brand?.slug?.current === brand || (typeof p.brand === "string" && p.brand === brand));
          if (category) filtered = filtered.filter((p) => p.category?.slug?.current === category);
          if (subtype) filtered = filtered.filter((p) => (p as { subtype?: string }).subtype === subtype);
          setFilteredProducts(filtered);
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
          <SectionHeader
            title={ru.sectionSearchResults}
            emoji="🔍"
          />
          {searchLoading ? (
            <div className="grid grid-cols-2 gap-3 px-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] animate-pulse rounded-xl bg-secondary"
                />
              ))}
            </div>
          ) : (() => {
            const displaySearch = saleOnly
              ? searchProducts.filter((p) => p.isOnSale)
              : searchProducts;
            return displaySearch.length === 0 ? (
              <p className="px-4 py-8 text-center text-muted-foreground">
                {ru.searchNoResults}
              </p>
            ) : (
              <ProductGrid products={displaySearch} />
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
          <SectionHeader
            title={ru.sectionFilteredResults}
            emoji="🔍"
          />
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
                      <div
                        key={i}
                        className="aspect-[3/4] animate-pulse rounded-xl bg-secondary"
                      />
                    ))}
                  </div>
                ) : (
                  <ProductGrid products={filteredProducts || []} />
                )}
              </>
            );
          })()}
        </motion.div>
      ) : (
        // Curated Sections View
        <div className="space-y-6 py-4">
          {/* Section 1: Hot Drops */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <SectionHeader title={ru.sectionHotDrops} emoji="🔥" />
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
            <SectionHeader title={ru.sectionSaleSteal} emoji="💸" />
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
            <SectionHeader title={ru.sectionFreshArrivals} emoji="🆕" />
            {loading ? (
              <div className="grid grid-cols-2 gap-3 px-4">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[3/4] animate-pulse rounded-xl bg-secondary"
                  />
                ))}
              </div>
            ) : (
              <ProductGrid products={freshArrivals} />
            )}
          </motion.section>
        </div>
      )}
    </div>
  );
}
