/**
 * RangeSlider Component
 * 
 * Accessible dual-thumb range slider using Radix UI.
 */

import * as Slider from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

export interface RangeSliderProps {
    /** Current range value [min, max] */
    value: [number, number];
    /** Callback when range changes */
    onChange: (value: [number, number]) => void;
    /** Minimum allowed value */
    min?: number;
    /** Maximum allowed value */
    max?: number;
    /** Step increment */
    step?: number;
    /** Format display value */
    formatValue?: (value: number) => string;
    /** Label for the slider */
    label?: string;
    /** Size variant */
    size?: 'sm' | 'md';
    /** Disable the slider */
    disabled?: boolean;
    /** Additional class name */
    className?: string;
}

const trackStyles = {
    sm: 'h-1',
    md: 'h-1.5',
};

const thumbStyles = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
};

export function RangeSlider({
    value,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    formatValue = String,
    label,
    size = 'sm',
    disabled = false,
    className,
}: RangeSliderProps) {
    return (
        <div className={className}>
            {label && (
                <label className="text-xs text-slate-500 block mb-2">
                    {label} ({formatValue(value[0])}–{formatValue(value[1])})
                </label>
            )}
            <Slider.Root
                className={cn(
                    'relative flex items-center select-none touch-none w-full',
                    trackStyles[size],
                    disabled && 'opacity-50 pointer-events-none'
                )}
                value={value}
                onValueChange={(v) => onChange(v as [number, number])}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
            >
                <Slider.Track className={cn('bg-slate-800 relative grow rounded-full', trackStyles[size])}>
                    <Slider.Range className="absolute bg-sky-500 rounded-full h-full" />
                </Slider.Track>
                <Slider.Thumb
                    className={cn(
                        'block bg-white rounded-full shadow-md hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500',
                        thumbStyles[size]
                    )}
                    aria-label="Minimum value"
                />
                <Slider.Thumb
                    className={cn(
                        'block bg-white rounded-full shadow-md hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500',
                        thumbStyles[size]
                    )}
                    aria-label="Maximum value"
                />
            </Slider.Root>
        </div>
    );
}
