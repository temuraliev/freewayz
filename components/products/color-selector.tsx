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

/**
 * COLOR_MAP — exact color names from Sanity → hex.
 * Keys are LOWERCASE for case-insensitive lookup.
 * Built from: array::unique(*[_type=="product"].colors[])
 */
const COLOR_MAP: Record<string, string> = {
  // ── Exact Sanity values ─────────────────────────────────────
  black: "#000000",
  white: "#FFFFFF",
  grey: "#6B7280",
  "dark grey": "#374151",
  "light grey": "#D1D5DB",
  blue: "#2563EB",
  "dark blue": "#1E3A8A",
  "light blue": "#93C5FD",
  "navy blue": "#1E3A5F",
  navy: "#1E3A5F",
  green: "#166534",
  "dark green": "#14532D",
  "light green": "#86EFAC",
  "sage green": "#BCB88A",
  "olive green": "#6B8E23",
  olive: "#808000",
  brown: "#8B4513",
  "dark brown": "#3E2723",
  "light brown": "#A0826D",
  red: "#DC2626",
  pink: "#FFC0CB",
  "light pink": "#FFB6C1",
  cream: "#FFFDD0",
  beige: "#F5F5DC",
  khaki: "#C3B091",
  orange: "#F97316",
  yellow: "#EAB308",
  purple: "#7C3AED",
  teal: "#008080",
  anthracite: "#383E42",
  "washed black": "#2D2D2D",
  camo: "#5C6B3C",
  punk: "#E91E63",

  // Texture variants (Grey Texture / Grey Smooth → grey shades)
  "grey texture": "#7B7D80",
  "grey smooth": "#9CA0A5",

  // ── Aliases for safety ──────────────────────────────────────
  gray: "#6B7280",
  "dark gray": "#374151",
  "light gray": "#D1D5DB",
  charcoal: "#36454F",
  silver: "#C0C0C0",
  tan: "#D2B48C",
  ivory: "#FFFFF0",
  sand: "#C2B280",
  camel: "#C19A6B",
  burgundy: "#800020",
  wine: "#722F37",
  maroon: "#800000",
  coral: "#FF7F50",
  salmon: "#FA8072",
  "hot pink": "#FF69B4",
  rose: "#FF007F",
  magenta: "#FF00FF",
  fuchsia: "#FF00FF",
  "burnt orange": "#CC5500",
  rust: "#B7410E",
  peach: "#FFCBA4",
  gold: "#FFD700",
  mustard: "#FFDB58",
  amber: "#FFBF00",
  lavender: "#E6E6FA",
  lilac: "#C8A2C8",
  violet: "#8F00FF",
  plum: "#8E4585",
  mauve: "#E0B0FF",
  indigo: "#3F51B5",
  cobalt: "#0047AB",
  denim: "#1560BD",
  mint: "#98FF98",
  emerald: "#50C878",
  moss: "#8A9A5B",
  lime: "#32CD32",
  "off-white": "#FAF9F6",
  "off white": "#FAF9F6",
  bone: "#E3DAC9",
  chocolate: "#3C1F0C",
  taupe: "#483C32",
  mocha: "#967969",
  "baby blue": "#89CFF0",
  "royal blue": "#4169E1",
  "army green": "#4B5320",
  "forest green": "#228B22",
  crimson: "#DC143C",
  scarlet: "#FF2400",
  "white/camo": "#FFFFFF", // handled as dual color
};

/** Resolve a color name to hex. Case-insensitive. */
function resolveHex(name: string): string {
  const lower = name.toLowerCase().trim();
  if (COLOR_MAP[lower]) return COLOR_MAP[lower];
  // Fallback gray
  return "#9CA3AF";
}

/** Check if a color name contains a slash (dual color) */
function isDualColor(name: string): boolean {
  return name.includes("/");
}

/** Get CSS gradient for dual-color like "Grey/Black" */
function dualGradient(name: string): string {
  const parts = name.split("/");
  const a = resolveHex(parts[0]);
  const b = resolveHex(parts[1]);
  return `linear-gradient(to right, ${a} 50%, ${b} 50%)`;
}

/** Check whether a hex color is "light" (for check icon contrast) */
function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length < 6) return false;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
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
          const dual = isDualColor(color);
          const hex = resolveHex(color);
          const light = dual
            ? isLightColor(resolveHex(color.split("/")[0])) &&
            isLightColor(resolveHex(color.split("/")[1]))
            : isLightColor(hex);

          return (
            <div key={color} className="flex flex-col items-center gap-1">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => onSelect(color)}
                className={cn(
                  "relative h-10 w-10 rounded-full border-2 transition-all overflow-hidden",
                  isSelected
                    ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "border-border hover:border-muted-foreground"
                )}
                style={{
                  background: dual ? dualGradient(color) : hex,
                }}
                title={color}
              >
                {isSelected && (
                  <Check
                    className={cn(
                      "absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2",
                      light ? "text-black" : "text-white"
                    )}
                  />
                )}
              </motion.button>
              <span
                className={cn(
                  "text-[9px] leading-tight text-center max-w-[48px] truncate",
                  isSelected ? "text-foreground font-medium" : "text-muted-foreground/70"
                )}
              >
                {color}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
