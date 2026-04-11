"use client";

import { motion } from "framer-motion";
import { cn } from "@shared/utils";

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-all",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-secondary/50 text-muted-foreground hover:border-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </motion.button>
  );
}
