"use client";

import { useEffect } from "react";
import { initBrowserAnalytics } from "@frontend/lib/analytics";

export function AnalyticsProvider() {
  useEffect(() => {
    initBrowserAnalytics();
  }, []);
  return null;
}
