"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingBag, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { ImageCarousel, type CarouselMediaItem } from "@/components/products/image-carousel";
import { ModelViewer3d } from "@/components/products/model-viewer-3d";
import { SizeSelector } from "@/components/products/size-selector";
import { ColorSelector } from "@/components/products/color-selector";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/store";
import { useHapticFeedback } from "@/components/providers/telegram-provider";
import { toast } from "@/components/ui/use-toast";
import { Product, Size, Color } from "@/lib/types";
import { formatPrice } from "@/lib/utils";
import { client } from "@/lib/sanity/client";
import { ru } from "@/lib/i18n/ru";
import { productBySlugQuery } from "@/lib/sanity/queries";

// Mock product for development
const MOCK_PRODUCT: Product = {
  _id: "1",
  title: "Washed Black Hoodie",
  slug: { current: "washed-black-hoodie" },
  price: 280,
  images: [
    "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&q=80",
    "https://images.unsplash.com/photo-1509942774463-acf339cf87d5?w=800&q=80",
    "https://images.unsplash.com/photo-1578768079052-aa76e52ff62e?w=800&q=80",
  ],
  category: { title: "Hoodies", slug: { current: "hoodies" } },
  style: { _id: "opium", title: "Opium", slug: { current: "opium" } },
  brand: { _id: "hellstar", title: "Hellstar", slug: { current: "hellstar" } },
  sizes: ["S", "M", "L", "XL"],
  colors: ["Black", "Grey"],
};

interface ProductPageClientProps {
  slug: string;
}

export function ProductPageClient({ slug }: ProductPageClientProps) {
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState<Size | null>(null);
  const [selectedColor, setSelectedColor] = useState<Color | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const addItem = useCartStore((state) => state.addItem);
  const haptic = useHapticFeedback();

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const data = await client.fetch(productBySlugQuery, { slug });
        if (data) {
          setProduct(data);
          if (data.colors?.length > 0) {
            setSelectedColor(data.colors[0]);
          }
        } else {
          setProduct(MOCK_PRODUCT);
          if (MOCK_PRODUCT.colors?.length > 0) {
            setSelectedColor(MOCK_PRODUCT.colors[0]);
          }
        }
      } catch (error) {
        console.log("Using mock product:", error);
        setProduct(MOCK_PRODUCT);
        if (MOCK_PRODUCT.colors?.length > 0) {
          setSelectedColor(MOCK_PRODUCT.colors[0]);
        }
      }
      setLoading(false);
    };

    fetchProduct();
  }, [slug]);

  const handleAddToCart = async () => {
    if (!product || !selectedSize) {
      haptic.notification("error");
      toast({
        title: ru.pleaseSelectSize,
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    haptic.impact("medium");

    await new Promise((resolve) => setTimeout(resolve, 300));

    addItem(product, selectedSize, selectedColor);

    setShowSuccess(true);
    haptic.notification("success");

    toast({
      title: ru.addedToCart,
      description: `${typeof product.brand === 'string' ? product.brand : product.brand?.title} ${product.title}`,
      variant: "success",
    });

    setTimeout(() => {
      setIsAdding(false);
      setShowSuccess(false);
    }, 1500);
  };

  if (loading) {
    return (
      <div className="min-h-screen animate-pulse">
        <div className="aspect-square bg-secondary" />
        <div className="space-y-4 p-4">
          <div className="h-6 w-20 rounded bg-secondary" />
          <div className="h-8 w-3/4 rounded bg-secondary" />
          <div className="h-6 w-24 rounded bg-secondary" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <p className="text-lg text-muted-foreground">{ru.productNotFound}</p>
        <Button onClick={() => router.back()} variant="outline" className="mt-4">
          {ru.goBack}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg">
        <button
          onClick={() => router.back()}
          className="flex h-14 items-center gap-2 px-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
          {ru.back}
        </button>
      </div>

      <ImageCarousel
        media={[
          ...(product.videos ?? []).map((url): CarouselMediaItem => ({ type: "video", url })),
          ...(product.images ?? []).map((url): CarouselMediaItem => ({ type: "image", url })),
        ]}
        alt={product.title}
      />

      {product.model3d && (
        <div className="px-4">
          <p className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {ru.view3D}
          </p>
          <ModelViewer3d src={product.model3d} alt={product.title} />
        </div>
      )}

      <div className="space-y-6 p-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {typeof product.brand === 'string' ? product.brand : product.brand?.title}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">
            {product.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              {product.isOnSale && product.originalPrice != null ? (
                <>
                  <span className="font-mono text-2xl font-bold text-red-500">
                    {formatPrice(product.price)}
                  </span>
                  <span className="font-mono text-lg text-muted-foreground line-through">
                    {formatPrice(product.originalPrice)}
                  </span>
                </>
              ) : (
                <span className="font-mono text-2xl font-bold">
                  {formatPrice(product.price)}
                </span>
              )}
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
              {typeof product.style === 'string' ? product.style : product.style?.title}
            </span>
          </div>
        </div>

        {product.description && (
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {ru.description}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {product.description}
            </p>
          </div>
        )}

        <SizeSelector
          sizes={product.sizes}
          selectedSize={selectedSize}
          onSelect={(size) => {
            setSelectedSize(size);
            haptic.selection();
          }}
        />

        {product.colors && product.colors.length > 0 && (
          <ColorSelector
            colors={product.colors}
            selectedColor={selectedColor}
            onSelect={(color) => {
              setSelectedColor(color);
              haptic.selection();
            }}
          />
        )}
      </div>

      <div className="fixed bottom-20 left-0 right-0 z-40 border-t border-border bg-background/95 p-4 backdrop-blur-lg safe-bottom">
        <Button
          onClick={handleAddToCart}
          size="lg"
          className="w-full gap-2 text-base"
          disabled={isAdding}
        >
          <AnimatePresence mode="wait">
            {showSuccess ? (
              <motion.span
                key="success"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-2"
              >
                <Check className="h-5 w-5" />
                {ru.added}
              </motion.span>
            ) : (
              <motion.span
                key="default"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-2"
              >
                <ShoppingBag className="h-5 w-5" />
                {isAdding ? ru.adding : ru.addToCart}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </div>
  );
}
