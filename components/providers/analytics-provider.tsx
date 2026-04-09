"use client";

import { useEffect } from "react";
import { initBrowserAnalytics } from "@/lib/analytics";

export function AnalyticsProvider() {
  useEffect(() => {
    initBrowserAnalytics();
  }, []);
  return null;
}
