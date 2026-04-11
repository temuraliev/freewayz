"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const HERO = {
    tag: "FREEWAYZ",
    title: "STYLE\nFOR ALL",
    subtitle: "Premium streetwear. Affordable prices.",
    cta: "Shop Now",
    href: "/",
};

export function HeroSection() {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="relative mx-3 mb-2 overflow-hidden"
            style={{ borderRadius: "4px" }}
        >
            <div
                className="relative flex flex-col justify-end bg-gradient-to-br from-black via-zinc-900 to-black"
                style={{ minHeight: "280px", padding: "0" }}
            >
                {/* Grid texture overlay */}
                <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                        backgroundImage: `
              linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)
            `,
                        backgroundSize: "40px 40px",
                    }}
                />

                {/* Noise overlay */}
                <div
                    className="absolute inset-0 opacity-[0.08]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
                    }}
                />

                {/* Glow blob */}
                <div
                    className="absolute -bottom-10 -right-10 h-48 w-48 rounded-full opacity-20 blur-3xl"
                    style={{ background: "radial-gradient(circle, #ffffff 0%, transparent 70%)" }}
                />

                {/* Content */}
                <div className="relative z-10 p-6 pb-7">
                    <div className="mb-4 inline-flex items-center gap-2">
                        <span className="h-px w-8" style={{ background: "rgba(255,255,255,0.4)" }} />
                        <span
                            className="text-[9px] font-bold uppercase tracking-[0.22em] font-mono"
                            style={{
                                color: "rgba(255,255,255,0.5)",
                            }}
                        >
                            {HERO.tag}
                        </span>
                    </div>

                    <h2
                        className="mb-2 text-[52px] font-bold leading-[0.9]"
                        style={{
                            fontFamily: "var(--font-display)",
                            textTransform: "uppercase",
                            letterSpacing: "-0.02em",
                            color: "#fff",
                        }}
                    >
                        {HERO.title.split("\n").map((line, i) => (
                            <span key={i} className="block">{line}</span>
                        ))}
                    </h2>

                    <p
                        className="mb-5 text-[11px] tracking-widest font-mono"
                        style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                        {HERO.subtitle}
                    </p>

                    <Link href={HERO.href}>
                        <motion.button
                            whileTap={{ scale: 0.97 }}
                            className="inline-flex items-center gap-2 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest backdrop-blur-sm transition-all"
                            style={{
                                borderRadius: "2px",
                                border: "1px solid rgba(255,255,255,0.3)",
                                background: "rgba(255,255,255,0.1)",
                                color: "#fff",
                            }}
                        >
                            {HERO.cta}
                            <ArrowRight className="h-3 w-3" />
                        </motion.button>
                    </Link>
                </div>
            </div>
        </motion.div>
    );
}
