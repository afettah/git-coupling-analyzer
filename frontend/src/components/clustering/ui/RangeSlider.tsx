/**
 * Range Slider Component
 * 
 * Dual-thumb range slider for filtering by numeric ranges.
 */

import { useCallback } from 'react';

export interface RangeSliderProps {
    label: string;
    min: number;
    max: number;
    value: [number, number];
    onChange: (value: [number, number]) => void;
    step?: number;
    formatValue?: (value: number) => string;
    className?: string;
}

export function RangeSlider({
    label,
    min,
    max,
    value,
    onChange,
    step = 1,
    formatValue = String,
    className = ''
}: RangeSliderProps) {
    const handleMinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newMin = Number(e.target.value);
        onChange([Math.min(newMin, value[1]), value[1]]);
    }, [onChange, value]);

    const handleMaxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newMax = Number(e.target.value);
        onChange([value[0], Math.max(newMax, value[0])]);
    }, [onChange, value]);

    return (
        <div className={className}>
            <label className="text-xs text-slate-500">
                {label} ({formatValue(value[0])}–{formatValue(value[1])})
            </label>
            <div className="flex items-center gap-2 mt-1">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value[0]}
                    onChange={handleMinChange}
                    className="w-full accent-sky-500"
                />
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value[1]}
                    onChange={handleMaxChange}
                    className="w-full accent-sky-500"
                />
            </div>
        </div>
    );
}

export default RangeSlider;
