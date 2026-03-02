"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ru } from "@/lib/i18n/ru";

interface SectionHeaderProps {
  title: string;
  emoji?: string;
  href?: string;
}

export function SectionHeader({ title, emoji, href }: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between px-4 py-3"
    >
      <h2 className="font-headline text-lg tracking-wide">
        {emoji && <span className="mr-2">{emoji}</span>}
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {ru.viewAll}
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </motion.div>
  );
}
