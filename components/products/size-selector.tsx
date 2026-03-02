"use client";

import { Size } from "@/lib/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SizeSelectorProps {
  sizes: Size[];
  selectedSize: Size | null;
  onSelect: (size: Size) => void;
}

export function SizeSelector({
  sizes,
  selectedSize,
  onSelect,
}: SizeSelectorProps) {
  const allSizes: Size[] = ["XS", "S", "M", "L", "XL", "XXL"];

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Size
      </h3>
      <div className="flex flex-wrap gap-2">
        {allSizes.map((size) => {
          const isAvailable = sizes.includes(size);
          const isSelected = selectedSize === size;

          return (
            <motion.button
              key={size}
              whileTap={{ scale: isAvailable ? 0.95 : 1 }}
              onClick={() => isAvailable && onSelect(size)}
              disabled={!isAvailable}
              className={cn("size-btn", isSelected && "selected")}
            >
              {size}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
