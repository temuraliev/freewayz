"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { motion, useMotionValue, animate } from "framer-motion";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { ru } from "@/lib/i18n/ru";

export type CarouselMediaItem =
  | { type: "image"; url: string }
  | { type: "video"; url: string };

interface ImageCarouselProps {
  /** Videos first, then images. Build this order when passing from product page. */
  media: CarouselMediaItem[];
  alt: string;
}

export function ImageCarousel({ media, alt }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === media.length - 1 ? 0 : prev + 1));
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => setWidth(el.offsetWidth);
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (width > 0) x.set(-currentIndex * width);
  }, [currentIndex, width, x]);

  const handleDragEnd = () => {
    if (width <= 0) return;
    const currentX = x.get();
    let newIndex = Math.round(-currentX / width);
    newIndex = Math.max(0, Math.min(newIndex, media.length - 1));
    setCurrentIndex(newIndex);
    animate(x, -newIndex * width, { type: "spring", stiffness: 300, damping: 30 });
  };

  if (!media || media.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center bg-secondary">
        <span className="text-muted-foreground">{ru.noImage}</span>
      </div>
    );
  }

  const current = media[currentIndex];

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="relative aspect-square overflow-hidden bg-secondary"
      >
        {media.length === 1 ? (
          <div className="relative h-full w-full">
            {current.type === "video" ? (
              <video
                src={current.url}
                controls
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              <Image
                src={current.url}
                alt={`${alt} - 1`}
                fill
                className="object-cover"
                priority
              />
            )}
          </div>
        ) : (
          <motion.div
            className="flex h-full"
            style={{
              width: media.length * width || "100%",
              x,
            }}
            drag="x"
            dragConstraints={
              width > 0
                ? { left: -(media.length - 1) * width, right: 0 }
                : undefined
            }
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {media.map((item, index) => (
              <div
                key={index}
                className="relative h-full flex-shrink-0"
                style={{ width }}
              >
                {item.type === "video" ? (
                  <video
                    src={item.url}
                    controls
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Image
                    src={item.url}
                    alt={`${alt} - ${index + 1}`}
                    fill
                    className="object-cover"
                    priority={index === 0}
                    draggable={false}
                  />
                )}
              </div>
            ))}
          </motion.div>
        )}

        {media.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {media.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-2">
          {media.map((item, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                "relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                index === currentIndex
                  ? "border-primary"
                  : "border-transparent opacity-60 hover:opacity-100"
              )}
            >
              {item.type === "video" ? (
                <div className="flex h-full w-full items-center justify-center bg-black/80">
                  <Play className="h-6 w-6 text-white" />
                </div>
              ) : (
                <Image
                  src={item.url}
                  alt={`${alt} thumbnail ${index + 1}`}
                  fill
                  className="object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
