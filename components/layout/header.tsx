"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useUserStore } from "@/lib/store";
import { getUserStatusEmoji } from "@/lib/utils";
import { motion } from "framer-motion";

export function Header() {
  const { user, getStatusLabel } = useUserStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2"
        >
          <Image
            src="/freewayz-logo.png"
            alt="FreeWayz"
            width={140}
            height={36}
            priority
            className="h-7 w-auto opacity-95"
          />
        </motion.div>

        {/* User Status Badge */}
        {mounted && user && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              user.status === "LEGEND"
                ? "status-legend"
                : user.status === "PRO"
                ? "status-pro"
                : "status-rookie"
            }`}
          >
            <span>{getUserStatusEmoji(user.status)}</span>
            <span>{getStatusLabel()}</span>
          </motion.div>
        )}
      </div>
    </header>
  );
}
