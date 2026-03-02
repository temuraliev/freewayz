"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingBag, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { ImageCarousel, type CarouselMediaItem } from "@/components/products/image-carousel";
import dynamic from "next/dynamic";
import { SizeSelector } from "@/components/products/size-selector";
import { ColorSelector } from "@/components/products/color-selector";
import { useCartStore } from "@/lib/store";
import { useHapticFeedback } from "@/components/providers/telegram-provider";
import { toast } from "@/components/ui/use-toast";
import { Product, Size, Color } from "@/lib/types";
import { formatPrice } from "@/lib/utils";
import { ru } from "@/lib/i18n/ru";

const ModelViewer3d = dynamic(
  () => import("@/components/products/model-viewer-3d").then((mod) => mod.ModelViewer3d),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-square items-center justify-center border border-border bg-secondary/50">
        <div className="h-5 w-5 animate-spin border-2 border-primary border-t-transparent rounded-full" />
      </div>
    ),
  }
);

interface ProductPageClientProps {
  product: Product;
}

export function ProductPageClient({ product }: ProductPageClientProps) {
  const router = useRouter();
  const [selectedSize, setSelectedSize] = useState<Size | null>(null);
  const [selectedColor, setSelectedColor] = useState<Color | null>(
    product.colors && product.colors.length > 0 ? product.colors[0] : null
  );
  const [isAdding, setIsAdding] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const addItem = useCartStore((state) => state.addItem);
  const haptic = useHapticFeedback();

  const handleAddToCart = async () => {
    if (!product || !selectedSize) {
      haptic.notification("error");
      toast({ title: ru.pleaseSelectSize, variant: "destructive" });
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
      description: `${typeof product.brand === "string" ? product.brand : product.brand?.title} ${product.title}`,
      variant: "success",
    });
    setTimeout(() => { setIsAdding(false); setShowSuccess(false); }, 1500);
  };

  const brandName = typeof product.brand === "string" ? product.brand : product.brand?.title;
  const styleName = typeof product.style === "string" ? product.style : product.style?.title;

  if (!product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <p className="text-muted-foreground">{ru.productNotFound}</p>
        <button onClick={() => router.back()} className="mt-4 border border-border px-6 py-3 text-sm">
          {ru.goBack}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      {/* Floating back button */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between p-4 pt-5">
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center border border-white/20 bg-black/50 backdrop-blur-sm"
        >
          <ArrowLeft className="h-4 w-4 text-white" />
        </motion.button>

        {/* Style tag */}
        {styleName && (
          <motion.span
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-black/50 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-white/70 backdrop-blur-sm"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {styleName}
          </motion.span>
        )}
      </div>

      {/* Image Carousel — full bleed */}
      <ImageCarousel
        media={[
          ...(product.videos ?? []).map((url): CarouselMediaItem => ({ type: "video", url })),
          ...(product.images ?? []).map((url): CarouselMediaItem => ({ type: "image", url })),
        ]}
        alt={product.title}
      />

      {/* 3D model */}
      {product.model3d && (
        <div className="px-4 pt-4">
          <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
            {ru.view3D}
          </p>
          <ModelViewer3d src={product.model3d} alt={product.title} />
        </div>
      )}

      {/* Product Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-6 px-4 pt-5"
      >
        {/* Brand + Name + Price */}
        <div>
          {brandName && (
            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
              {brandName}
            </p>
          )}
          <h1 className="text-[28px] font-bold uppercase leading-tight tracking-tight text-foreground" style={{ fontFamily: "var(--font-display)" }}>
            {product.title}
          </h1>

          {/* Divider */}
          <div className="editorial-divider mt-3 mb-4" />

          <div className="flex flex-wrap items-baseline gap-3">
            {product.isOnSale && product.originalPrice != null ? (
              <>
                <span className="font-mono text-2xl font-bold text-red-500">
                  {formatPrice(product.price)}
                </span>
                <span className="font-mono text-base text-muted-foreground line-through">
                  {formatPrice(product.originalPrice)}
                </span>
                <span className="bg-red-600 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white">
                  SALE
                </span>
              </>
            ) : (
              <span className="font-mono text-2xl font-bold text-foreground">
                {formatPrice(product.price)}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {product.description && (
          <div>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
              {ru.description}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          </div>
        )}

        {/* Size */}
        <SizeSelector
          sizes={product.sizes}
          selectedSize={selectedSize}
          onSelect={(size) => {
            setSelectedSize(size);
            haptic.selection();
          }}
        />

        {/* Color */}
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
      </motion.div>

      {/* Fixed CTA */}
      <div className="fixed bottom-[72px] left-0 right-0 z-40 border-t border-border bg-background/95 p-4 backdrop-blur-lg safe-bottom">
        <button
          onClick={handleAddToCart}
          disabled={isAdding}
          className="flex w-full items-center justify-center gap-2 bg-foreground py-4 text-[13px] font-extrabold uppercase tracking-[0.12em] text-background transition-opacity disabled:opacity-70"
          style={{ borderRadius: "2px" }}
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
                <Check className="h-4 w-4" />
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
                <ShoppingBag className="h-4 w-4" />
                {isAdding ? ru.adding : ru.addToCart}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </div>
  );
}
