"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@frontend/lib/analytics";
import { ArrowLeft, ShoppingBag, Check, Share2, Pencil, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { ImageCarousel, type CarouselMediaItem } from "@frontend/components/products/image-carousel";
import dynamic from "next/dynamic";
import { SizeSelector } from "@frontend/components/products/size-selector";
import { ColorSelector } from "@frontend/components/products/color-selector";
import { RelatedProducts } from "@frontend/components/products/related-products";
import { useCartStore, useWishlistStore, useAdminStore } from "@frontend/stores";
import { useHapticFeedback } from "@frontend/components/providers/telegram-provider";
import { toast } from "@frontend/components/ui/use-toast";
import { ProductEditOverlay } from "@frontend/components/admin/product-edit-overlay";
import { Product, Size, Color } from "@shared/types";
import { formatPrice } from "@shared/utils";
import { ru } from "@shared/i18n/ru";

const ModelViewer3d = dynamic(
  () => import("@frontend/components/products/model-viewer-3d").then((mod) => mod.ModelViewer3d),
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
  initialEditMode?: boolean;
}

export function ProductPageClient({ product, initialEditMode }: ProductPageClientProps) {
  const router = useRouter();
  const isAdmin = useAdminStore((s) => s.isAdmin);
  const [editOverlayOpen, setEditOverlayOpen] = useState(!!initialEditMode);
  const [selectedSize, setSelectedSize] = useState<Size | null>(null);
  const [selectedColor, setSelectedColor] = useState<Color | null>(
    product.colors && product.colors.length > 0 ? product.colors[0] : null
  );
  const [isAdding, setIsAdding] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [shareDone, setShareDone] = useState(false);

  const addItem = useCartStore((state) => state.addItem);
  const { isInWishlist, toggleItem } = useWishlistStore();
  const isLiked = isInWishlist(product._id);
  const haptic = useHapticFeedback();
  const brandSlugForView =
    typeof product.brand === "string" ? undefined : product.brand?.slug?.current;
  const styleSlugForView =
    typeof product.style === "string" ? undefined : product.style?.slug?.current;

  // Log product view (server) + analytics event (client)
  useEffect(() => {
    const initData =
      typeof window !== "undefined" && window.Telegram?.WebApp?.initData
        ? window.Telegram.WebApp.initData
        : "";

    track("view_product", {
      productId: product._id,
      productTitle: product.title,
      brand: typeof product.brand === "string" ? product.brand : product.brand?.title,
      price: product.price,
    });

    if (initData) {
      fetch("/api/products/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          productId: product._id,
          brandSlug: brandSlugForView,
          styleSlug: styleSlugForView,
        }),
      }).catch(() => {});
    }
  }, [product._id, product.title, product.price, product.brand, brandSlugForView, styleSlugForView]);

  const handleShare = async () => {
    const slug = product.slug.current;
    // Deep link that opens the Mini App directly in Telegram (not the browser)
    const miniAppUrl = `https://t.me/free_wayz_bot/shop?startapp=${slug}`;
    const text = `${brandName ? brandName + " " : ""}${product.title}`;

    try {
      const tg = (window as Window & {
        Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } }
      }).Telegram?.WebApp;

      if (tg?.openTelegramLink) {
        // Share via Telegram native share sheet — link opens Mini App, not browser
        tg.openTelegramLink(
          `https://t.me/share/url?url=${encodeURIComponent(miniAppUrl)}&text=${encodeURIComponent(text)}`
        );
      } else {
        // Outside Telegram — copy Mini App link to clipboard
        await navigator.clipboard.writeText(miniAppUrl);
      }
    } catch {
      try { await navigator.clipboard.writeText(miniAppUrl); } catch { /* ignore */ }
    }
    setShareDone(true);
    haptic.notification("success");
    setTimeout(() => setShareDone(false), 2000);
  };

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

        <div className="flex items-center gap-2">
          {/* Admin Edit button */}
          {isAdmin === true && (
            <motion.button
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.11 }}
              onClick={() => setEditOverlayOpen(true)}
              className="flex h-9 w-9 items-center justify-center border border-white/20 bg-black/50 backdrop-blur-sm"
              aria-label="Edit product"
            >
              <Pencil className="h-4 w-4 text-white" />
            </motion.button>
          )}

          {/* Wishlist button */}
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12 }}
            onClick={() => {
              haptic.impact("light");
              toggleItem(product);
            }}
            className="flex h-9 w-9 items-center justify-center border border-white/20 bg-black/50 backdrop-blur-sm transition-colors"
            aria-label={isLiked ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart
              className={`h-4 w-4 transition-colors ${
                isLiked ? "fill-red-500 text-red-500" : "text-white"
              }`}
            />
          </motion.button>

          {/* Share button */}
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.13 }}
            onClick={handleShare}
            className="flex h-9 w-9 items-center justify-center border border-white/20 bg-black/50 backdrop-blur-sm transition-colors"
          >
            <AnimatePresence mode="wait">
              {shareDone ? (
                <motion.div key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Check className="h-4 w-4 text-green-400" />
                </motion.div>
              ) : (
                <motion.div key="share" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Share2 className="h-4 w-4 text-white" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Style tag */}
          {styleName && (
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.14 }}
              className="bg-black/50 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-white/70 backdrop-blur-sm"
                         >
              {styleName}
            </motion.span>
          )}
        </div>
      </div>

      {/* Image Carousel — full bleed (only valid URLs to avoid 500) */}
      <ImageCarousel
        media={[
          ...(product.videos ?? []).filter((url): url is string => Boolean(url)).map((url): CarouselMediaItem => ({ type: "video", url })),
          ...(product.images ?? []).filter((url): url is string => Boolean(url)).map((url): CarouselMediaItem => ({ type: "image", url })),
        ]}
        alt={product.title}
      />

      {/* 3D model */}
      {product.model3d && (
        <div className="px-4 pt-4">
          <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
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
            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">
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
          <div className="border-t border-border pt-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/90">
              {ru.description}
            </p>
            <div className="text-[15px] leading-7 text-foreground/90 tracking-tight">
              {(product.description || "")
                .split(/\n\n+/)
                .filter(Boolean)
                .map((paragraph, i) => (
                  <p key={i} className={i > 0 ? "mt-4" : ""}>
                    {paragraph.split("\n").map((line, j) => (
                      <span key={j}>
                        {j > 0 && <br />}
                        {line}
                      </span>
                    ))}
                  </p>
                ))}
            </div>
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

        {/* Delivery info */}
        <div className="mt-4 space-y-1.5 text-[11px] text-muted-foreground border-t border-border pt-4">
          <p>🚚 Доставка включена в стоимость</p>
          <p>📦 Товар под заказ — срок доставки 7-12 дней</p>
          <p>🔄 Замена только при браке</p>
        </div>
      </motion.div>

      {/* Related Products / Recommendations */}
      <RelatedProducts 
        currentProductId={product._id} 
        brandId={typeof product.brand !== "string" ? product.brand?._id : undefined}
        styleId={typeof product.style !== "string" ? product.style?._id : undefined}
        categoryId={typeof product.category !== "string" ? product.category?._id : undefined}
      />

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

      <ProductEditOverlay
        product={product}
        open={editOverlayOpen}
        onOpenChange={setEditOverlayOpen}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
