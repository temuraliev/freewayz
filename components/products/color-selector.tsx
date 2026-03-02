"use client";

import { Color } from "@/lib/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface ColorSelectorProps {
  colors: Color[];
  selectedColor: Color | null;
  onSelect: (color: Color) => void;
}

const COLOR_MAP: Record<Color, string> = {
  Black: "#000000",
  White: "#FFFFFF",
  Grey: "#6B7280",
  Brown: "#8B4513",
  Navy: "#1E3A5F",
  Cream: "#FFFDD0",
  Red: "#DC2626",
  Green: "#166534",
};

export function ColorSelector({
  colors,
  selectedColor,
  onSelect,
}: ColorSelectorProps) {
  if (!colors || colors.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Color
        {selectedColor && (
          <span className="ml-2 normal-case text-foreground">
            {selectedColor}
          </span>
        )}
      </h3>
      <div className="flex flex-wrap gap-3">
        {colors.map((color) => {
          const isSelected = selectedColor === color;
          const isLight = ["White", "Cream"].includes(color);

          return (
            <motion.button
              key={color}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(color)}
              className={cn(
                "relative h-10 w-10 rounded-full border-2 transition-all",
                isSelected
                  ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "border-border hover:border-muted-foreground"
              )}
              style={{ backgroundColor: COLOR_MAP[color] }}
              title={color}
            >
              {isSelected && (
                <Check
                  className={cn(
                    "absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2",
                    isLight ? "text-black" : "text-white"
                  )}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
