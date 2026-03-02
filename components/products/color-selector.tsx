"use client";

import { Color } from "@/lib/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { ru } from "@/lib/i18n/ru";

interface ColorSelectorProps {
  colors: Color[];
  selectedColor: Color | null;
  onSelect: (color: Color) => void;
}

/**
 * Comprehensive color-name → hex map.
 * Covers common English color names used in streetwear.
 * Case-insensitive lookup via `resolveColor()`.
 */
const COLOR_MAP: Record<string, string> = {
  // Neutrals
  black: "#000000",
  white: "#FFFFFF",
  grey: "#6B7280",
  gray: "#6B7280",
  "light grey": "#D1D5DB",
  "light gray": "#D1D5DB",
  "dark grey": "#374151",
  "dark gray": "#374151",
  charcoal: "#36454F",
  silver: "#C0C0C0",

  // Browns & earthy
  brown: "#8B4513",
  "dark brown": "#3E2723",
  "light brown": "#A0826D",
  tan: "#D2B48C",
  beige: "#F5F5DC",
  cream: "#FFFDD0",
  ivory: "#FFFFF0",
  sand: "#C2B280",
  khaki: "#C3B091",
  camel: "#C19A6B",
  mocha: "#967969",
  taupe: "#483C32",
  coffee: "#6F4E37",
  chocolate: "#3C1F0C",

  // Blues
  navy: "#1E3A5F",
  blue: "#2563EB",
  "light blue": "#93C5FD",
  "dark blue": "#1E3A8A",
  "royal blue": "#4169E1",
  "baby blue": "#89CFF0",
  cobalt: "#0047AB",
  teal: "#008080",
  cyan: "#00BCD4",
  indigo: "#3F51B5",
  "powder blue": "#B0E0E6",
  denim: "#1560BD",

  // Greens
  green: "#166534",
  "dark green": "#14532D",
  "light green": "#86EFAC",
  olive: "#808000",
  "forest green": "#228B22",
  sage: "#BCB88A",
  mint: "#98FF98",
  emerald: "#50C878",
  moss: "#8A9A5B",
  lime: "#32CD32",
  "army green": "#4B5320",
  hunter: "#355E3B",

  // Reds & pinks
  red: "#DC2626",
  "dark red": "#8B0000",
  burgundy: "#800020",
  wine: "#722F37",
  maroon: "#800000",
  crimson: "#DC143C",
  scarlet: "#FF2400",
  coral: "#FF7F50",
  salmon: "#FA8072",
  pink: "#FFC0CB",
  "hot pink": "#FF69B4",
  "light pink": "#FFB6C1",
  rose: "#FF007F",
  magenta: "#FF00FF",
  fuchsia: "#FF00FF",
  blush: "#DE5D83",
  raspberry: "#E30B5C",

  // Oranges & yellows
  orange: "#F97316",
  "burnt orange": "#CC5500",
  rust: "#B7410E",
  peach: "#FFCBA4",
  apricot: "#FBCEB1",
  yellow: "#EAB308",
  gold: "#FFD700",
  mustard: "#FFDB58",
  amber: "#FFBF00",
  "lemon yellow": "#FFF44F",

  // Purples
  purple: "#7C3AED",
  "dark purple": "#4A0E6B",
  lavender: "#E6E6FA",
  lilac: "#C8A2C8",
  violet: "#8F00FF",
  plum: "#8E4585",
  mauve: "#E0B0FF",
  "royal purple": "#7851A9",

  // Multi / special
  multicolor: "conic-gradient(red, yellow, green, blue, violet, red)",
  rainbow: "conic-gradient(red, orange, yellow, green, blue, indigo, violet, red)",
  neon: "#39FF14",
  "off-white": "#FAF9F6",
  "off white": "#FAF9F6",
  bone: "#E3DAC9",
};

/**
 * Resolve a color name (or slash-separated dual-color) to hex values.
 * Returns [hex] for single colors or [hex1, hex2] for dual colors like "Black/White".
 */
function resolveColor(name: string): string[] {
  const parts = name.split("/").map((s) => s.trim());

  return parts.map((part) => {
    const lower = part.toLowerCase();
    if (COLOR_MAP[lower]) return COLOR_MAP[lower];

    // Try to match CSS named colors via a temporary element approach.
    // Fall back to a medium-gray swatch with a "?" vibe.
    return "#9CA3AF";
  });
}

/** Check whether a resolved hex is "light" to pick check icon color */
function isLightColor(hex: string): boolean {
  if (hex.startsWith("conic") || hex.startsWith("linear")) return false;
  const c = hex.replace("#", "");
  if (c.length < 6) return false;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // Relative luminance simplified
  return r * 0.299 + g * 0.587 + b * 0.114 > 186;
}

export function ColorSelector({
  colors,
  selectedColor,
  onSelect,
}: ColorSelectorProps) {
  if (!colors || colors.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {ru.color}
        {selectedColor && (
          <span className="ml-2 normal-case text-foreground">
            {selectedColor}
          </span>
        )}
      </h3>
      <div className="flex flex-wrap gap-3">
        {colors.map((color) => {
          const isSelected = selectedColor === color;
          const resolved = resolveColor(color);
          const isDual = resolved.length >= 2;
          const light = isDual
            ? isLightColor(resolved[0]) && isLightColor(resolved[1])
            : isLightColor(resolved[0]);

          return (
            <motion.button
              key={color}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(color)}
              className={cn(
                "relative h-10 w-10 rounded-full border-2 transition-all overflow-hidden",
                isSelected
                  ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "border-border hover:border-muted-foreground"
              )}
              title={color}
            >
              {isDual ? (
                /* Split circle — left half: color1, right half: color2 */
                <>
                  <span
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(to right, ${resolved[0]} 50%, ${resolved[1]} 50%)`,
                    }}
                  />
                </>
              ) : (
                <span
                  className="absolute inset-0 rounded-full"
                  style={{ background: resolved[0] }}
                />
              )}

              {isSelected && (
                <Check
                  className={cn(
                    "absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 z-10",
                    light ? "text-black" : "text-white"
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
