"use client";

import { useFilterStore, SortBy } from "@/lib/store/filter-store";
import { cn } from "@/lib/utils";
import { ArrowDownUp } from "lucide-react";
import { ru } from "@/lib/i18n/ru";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
    { value: "default", label: ru.sortDefault },
    { value: "price-asc", label: ru.sortPriceAsc },
    { value: "price-desc", label: ru.sortPriceDesc },
    { value: "name-asc", label: ru.sortNameAsc },
    { value: "newest", label: ru.sortNewest },
];

export function SortDropdown() {
    const sortBy = useFilterStore((s) => s.sortBy);
    const setSortBy = useFilterStore((s) => s.setSortBy);

    return (
        <div className="flex items-center gap-2 overflow-x-auto px-4 scrollbar-hide">
            <ArrowDownUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            {SORT_OPTIONS.map((option) => (
                <button
                    key={option.value}
                    onClick={() => setSortBy(option.value)}
                    className={cn(
                        "flex-shrink-0 rounded-full border px-2.5 py-1 text-xs transition-all whitespace-nowrap",
                        sortBy === option.value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-secondary/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
