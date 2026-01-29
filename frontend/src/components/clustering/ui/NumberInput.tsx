/**
 * Number Input Component
 * 
 * Styled number input with label.
 */

import { useCallback } from 'react';

export interface NumberInputProps {
    value: number;
    onChange: (value: number) => void;
    label?: string;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
    width?: string;
}

export function NumberInput({
    value,
    onChange,
    label,
    min,
    max,
    step = 1,
    className = '',
    width = 'w-16'
}: NumberInputProps) {
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = Number(e.target.value);
        if (!isNaN(newValue)) {
            onChange(newValue);
        }
    }, [onChange]);

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {label && <label className="text-xs text-slate-500">{label}</label>}
            <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={handleChange}
                className={`bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500 ${width}`}
            />
        </div>
    );
}

export default NumberInput;
