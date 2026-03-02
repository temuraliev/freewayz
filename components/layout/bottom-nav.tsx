"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingBag, User } from "lucide-react";
import { motion } from "framer-motion";
import { useCartStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ru } from "@/lib/i18n/ru";

const navItems = [
  { href: "/", icon: Home, label: ru.navHome },
  { href: "/cart", icon: ShoppingBag, label: ru.navCart },
  { href: "/profile", icon: User, label: ru.navProfile },
];

export function BottomNav() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const itemCount = useCartStore((state) => state.getItemCount());

  useEffect(() => {
    setMounted(true);
  }, []);

  const safeItemCount = mounted ? itemCount : 0;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/90 backdrop-blur-lg safe-bottom">
      <div className="flex h-16 items-stretch justify-around px-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          const showBadge = item.href === "/cart" && safeItemCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex h-full flex-col items-center justify-center gap-1"
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                className="relative flex w-6 justify-center"
              >
                <Icon
                  className={cn(
                    "h-6 w-6 transition-colors",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )}
                />

                {/* Cart Badge */}
                {showBadge && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
                  >
                    {safeItemCount > 9 ? "9+" : safeItemCount}
                  </motion.span>
                )}
              </motion.div>

              <span
                className={cn(
                  "text-[10px] font-medium transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
