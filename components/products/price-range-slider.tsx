"use client";

import { useState, useEffect, useCallback } from "react";
import { formatPrice } from "@/lib/utils";

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
    max = 10_000_000,
    step = 50_000,
    valueMin,
    valueMax,
    onChange,
}: PriceRangeSliderProps) {
    const [localMin, setLocalMin] = useState(valueMin ?? min);
    const [localMax, setLocalMax] = useState(valueMax ?? max);

    // Sync from parent
    useEffect(() => {
        setLocalMin(valueMin ?? min);
        setLocalMax(valueMax ?? max);
    }, [valueMin, valueMax, min, max]);

    const handleMinChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const val = Math.min(Number(e.target.value), localMax - step);
            setLocalMin(val);
        },
        [localMax, step]
    );

    const handleMaxChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const val = Math.max(Number(e.target.value), localMin + step);
            setLocalMax(val);
        },
        [localMin, step]
    );

    const handleCommit = useCallback(() => {
        const newMin = localMin <= min ? null : localMin;
        const newMax = localMax >= max ? null : localMax;
        onChange(newMin, newMax);
    }, [localMin, localMax, min, max, onChange]);

    // Percentage positions for the track highlight
    const minPercent = ((localMin - min) / (max - min)) * 100;
    const maxPercent = ((localMax - min) / (max - min)) * 100;

    return (
        <div className="space-y-4 px-1">
            {/* Labels */}
            <div className="flex items-center justify-between text-sm">
                <span className="font-mono text-muted-foreground">
                    {formatPrice(localMin)}
                </span>
                <span className="text-xs text-muted-foreground">—</span>
                <span className="font-mono text-muted-foreground">
                    {formatPrice(localMax)}
                </span>
            </div>

            {/* Dual range slider */}
            <div className="relative h-6">
                {/* Track background */}
                <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 rounded-full bg-secondary" />

                {/* Active track */}
                <div
                    className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary"
                    style={{
                        left: `${minPercent}%`,
                        right: `${100 - maxPercent}%`,
                    }}
                />

                {/* Min slider */}
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={localMin}
                    onChange={handleMinChange}
                    onMouseUp={handleCommit}
                    onTouchEnd={handleCommit}
                    className="range-slider absolute top-0 left-0 h-6 w-full appearance-none bg-transparent pointer-events-none"
                    style={{ zIndex: localMin > max - step * 2 ? 5 : 3 }}
                    aria-label="Мин. цена"
                />

                {/* Max slider */}
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={localMax}
                    onChange={handleMaxChange}
                    onMouseUp={handleCommit}
                    onTouchEnd={handleCommit}
                    className="range-slider absolute top-0 left-0 h-6 w-full appearance-none bg-transparent pointer-events-none"
                    style={{ zIndex: 4 }}
                    aria-label="Макс. цена"
                />
            </div>
        </div>
    );
}
