"use client";

import { useState, useEffect, useCallback } from "react";
import { formatPrice } from "@shared/utils";

interface PriceRangeSliderProps {
    min?: number;
    max?: number;
    step?: number;
    valueMin: number | null;
    valueMax: number | null;
    onChange: (min: number | null, max: number | null) => void;
}

export function PriceRangeSlider({
    min = 0,
    max = 15_000_000,
    step = 100_000,
    valueMin,
    valueMax,
    onChange,
}: PriceRangeSliderProps) {
    const [localMin, setLocalMin] = useState(valueMin ?? min);
    const [localMax, setLocalMax] = useState(valueMax ?? max);

    useEffect(() => {
        setLocalMin(valueMin ?? min);
        setLocalMax(valueMax ?? max);
    }, [valueMin, valueMax, min, max]);

    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Math.min(Number(e.target.value), localMax - step);
        setLocalMin(val);
    };

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Math.max(Number(e.target.value), localMin + step);
        setLocalMax(val);
    };

    const commit = useCallback(() => {
        const newMin = localMin <= min ? null : localMin;
        const newMax = localMax >= max ? null : localMax;
        onChange(newMin, newMax);
    }, [localMin, localMax, min, max, onChange]);

    const minPercent = ((localMin - min) / (max - min)) * 100;
    const maxPercent = ((localMax - min) / (max - min)) * 100;

    return (
        <div className="space-y-3">
            {/* Price labels */}
            <div className="flex items-center justify-between">
                <span className="rounded bg-secondary px-2 py-1 font-mono text-xs text-foreground">
                    {formatPrice(localMin)}
                </span>
                <span className="text-xs text-muted-foreground">—</span>
                <span className="rounded bg-secondary px-2 py-1 font-mono text-xs text-foreground">
                    {formatPrice(localMax)}
                </span>
            </div>

            {/* Slider track */}
            <div className="relative h-5 w-full">
                {/* Gray track bg */}
                <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-muted" />

                {/* Colored active track */}
                <div
                    className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-foreground"
                    style={{
                        left: `${minPercent}%`,
                        right: `${100 - maxPercent}%`,
                    }}
                />

                {/* MIN input */}
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={localMin}
                    onChange={handleMinChange}
                    onMouseUp={commit}
                    onTouchEnd={commit}
                    aria-label="Минимальная цена"
                    className="price-thumb absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    style={{ zIndex: localMin > max - step * 2 ? 5 : 3 }}
                />

                {/* MAX input */}
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={localMax}
                    onChange={handleMaxChange}
                    onMouseUp={commit}
                    onTouchEnd={commit}
                    aria-label="Максимальная цена"
                    className="price-thumb absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    style={{ zIndex: 4 }}
                />

                {/* Visual thumbs (non-interactive, positioned via CSS) */}
                <div
                    className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground bg-background shadow-md"
                    style={{ left: `${minPercent}%` }}
                />
                <div
                    className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground bg-background shadow-md"
                    style={{ left: `${maxPercent}%` }}
                />
            </div>
        </div>
    );
}
