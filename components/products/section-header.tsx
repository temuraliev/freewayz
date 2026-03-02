"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ru } from "@/lib/i18n/ru";

interface SectionHeaderProps {
  title: string;
  eyebrow?: string;
  href?: string;
}

export function SectionHeader({ title, eyebrow, href }: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex items-end justify-between px-4 pb-3 pt-5"
    >
      <div>
        {eyebrow && (
          <p className="section-eyebrow mb-1">{eyebrow}</p>
        )}
        <h2 className="section-h">{title}</h2>
      </div>

      {href && (
        <Link
          href={href}
          className="flex items-center gap-1 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {ru.viewAll}
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </motion.div>
  );
}
