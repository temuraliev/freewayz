"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingBag, Check, Heart } from "lucide-react";
import { useQuickViewStore, useCartStore, useWishlistStore } from "@frontend/stores";
import { ImageCarousel, type CarouselMediaItem } from "@frontend/components/products/image-carousel";
import { SizeSelector } from "@frontend/components/products/size-selector";
import { ColorSelector } from "@frontend/components/products/color-selector";
import { Size, Color } from "@shared/types";
import { formatPrice } from "@shared/utils";
import { ru } from "@shared/i18n/ru";
import { useHapticFeedback } from "@frontend/components/providers/telegram-provider";
import { toast } from "@frontend/components/ui/use-toast";
import Link from "next/link";
import { RemoveScroll } from "react-remove-scroll";

export function QuickViewModal() {
  const { isOpen, product, closeQuickView } = useQuickViewStore();
  const addItem = useCartStore((state) => state.addItem);
  const { isInWishlist, toggleItem } = useWishlistStore();
  const haptic = useHapticFeedback();

  const [selectedSize, setSelectedSize] = useState<Size | null>(null);
  const [selectedColor, setSelectedColor] = useState<Color | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Reset selections when product changes
  useEffect(() => {
    if (product) {
      setSelectedSize(null);
      setSelectedColor(product.colors && product.colors.length > 0 ? product.colors[0] : null);
    }
  }, [product]);

  // Handle hardware back button in Telegram Mini App to close modal instead of navigating back
  useEffect(() => {
    if (!isOpen) return;

    const tg = (window as Window & { Telegram?: { WebApp?: { BackButton?: { isVisible: boolean, show: () => void, hide: () => void, onClick: (cb: () => void) => void, offClick: (cb: () => void) => void } } } }).Telegram?.WebApp;
    if (!tg?.BackButton) return;

    const handleBack = () => {
      closeQuickView();
    };

    tg.BackButton.show();
    tg.BackButton.onClick(handleBack);

    return () => {
      tg.BackButton.offClick(handleBack);
      tg.BackButton.hide();
    };
  }, [isOpen, closeQuickView]);

  if (!product) return null;

  const handleAddToCart = async () => {
    if (!selectedSize) {
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
    
    setTimeout(() => {
      setIsAdding(false);
      setShowSuccess(false);
      closeQuickView(); // Auto-close modal after successful add to cart
    }, 1000);
  };

  const brandName = typeof product.brand === "string" ? product.brand : product.brand?.title;

  return (
    <AnimatePresence>
      {isOpen && (
        <RemoveScroll forwardProps>
          <div>
            {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeQuickView}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col overflow-hidden rounded-t-[24px] border-t border-border bg-background shadow-2xl"
          >
            {/* Header / Drag handle area */}
            <div className="relative flex items-center justify-center border-b border-border/50 px-4 py-3">
              <div className="absolute top-2 h-1 w-12 rounded-full bg-border" />
              <h3 className="text-sm font-semibold mt-2">{ru.quickView || "Быстрый просмотр"}</h3>
              <div className="absolute right-4 top-3 flex items-center gap-2">
                {product && (
                  <button
                    onClick={() => {
                      haptic.impact("light");
                      toggleItem(product);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/50 transition-colors hover:bg-secondary"
                  >
                    <Heart
                      className={`h-4 w-4 transition-colors ${
                        isInWishlist(product._id) ? "fill-red-500 text-red-500" : "text-foreground"
                      }`}
                    />
                  </button>
                )}
                <button
                  onClick={closeQuickView}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-[100px] scrollbar-hide">
              {/* Media Carousel */}
              <div className="relative aspect-[4/5] w-full bg-secondary/20">
                <ImageCarousel
                  media={[
                    ...(product.videos ?? []).map((url): CarouselMediaItem => ({ type: "video", url })),
                    ...(product.images ?? []).map((url): CarouselMediaItem => ({ type: "image", url })),
                  ]}
                  alt={product.title}
                />
              </div>

              {/* Product Info */}
              <div className="space-y-6 px-4 pt-5 pb-6">
                <div>
                  {brandName && (
                    <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground font-mono">
                      {brandName}
                    </p>
                  )}
                  <h2 className="text-[22px] font-bold uppercase leading-tight tracking-tight text-foreground font-display">
                    {product.title}
                  </h2>
                  <div className="mt-2 flex items-baseline gap-3">
                    {product.isOnSale && product.originalPrice != null ? (
                      <>
                        <span className="font-mono text-xl font-bold text-red-500">
                          {formatPrice(product.price)}
                        </span>
                        <span className="font-mono text-sm text-muted-foreground line-through">
                          {formatPrice(product.originalPrice)}
                        </span>
                      </>
                    ) : (
                      <span className="font-mono text-xl font-bold text-foreground">
                        {formatPrice(product.price)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Selectors */}
                <div className="space-y-5 border-t border-border pt-5">
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
                
                <div className="border-t border-border pt-4 text-center">
                  <Link 
                    href={`/product/${product.slug.current}`} 
                    onClick={closeQuickView}
                    className="text-xs uppercase tracking-widest text-muted-foreground underline-offset-4 hover:text-foreground hover:underline font-mono"
                  >
                    {ru.viewDetails || "Полное описание"}
                  </Link>
                </div>
              </div>
            </div>

            {/* Fixed CTA Area inside modal */}
            <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-background/95 p-4 backdrop-blur-lg safe-bottom">
              <button
                onClick={handleAddToCart}
                disabled={isAdding}
                className="flex w-full items-center justify-center gap-2 bg-foreground py-4 text-[13px] font-extrabold uppercase tracking-[0.12em] text-background transition-opacity disabled:opacity-70 rounded-md"
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
          </motion.div>
          </div>
        </RemoveScroll>
      )}
    </AnimatePresence>
  );
}
