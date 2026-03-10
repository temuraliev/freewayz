"use client";

import { useEffect } from "react";
import { useTierStore } from "@/lib/store";

export function TierThemeProvider() {
  const tier = useTierStore((s) => s.tier);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove("tier-top", "tier-ultimate");
    html.classList.add(`tier-${tier}`);
  }, [tier]);

  return null;
}
