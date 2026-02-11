/**
 * Select Component
 * 
 * Styled select dropdown with type-safe options.
 */

import { useCallback } from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption<T extends string = string> {
    value: T;
    label: string;
}

export interface SelectProps<T extends string = string> {
    value: T;
    onChange: (value: T) => void;
    options: SelectOption<T>[];
    label?: string;
    className?: string;
    size?: 'sm' | 'md';
    disabled?: boolean;
}

const sizeStyles = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
};

export function Select<T extends string = string>({
    value,
    onChange,
    options,
    label,
    className,
    size = 'sm',
    disabled = false,
}: SelectProps<T>) {
    const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(e.target.value as T);
    }, [onChange]);

    return (
        <div className={cn('flex items-center gap-2', className)}>
            {label && <label className="text-xs text-slate-500">{label}</label>}
            <select data-testid="select-select-select-1"
                value={value}
                onChange={handleChange}
                disabled={disabled}
                className={cn(
                    'bg-slate-950 border border-slate-800 rounded text-slate-200',
                    'focus:outline-none focus:border-sky-500',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    sizeStyles[size]
                )}
            >
                {options.map(option => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
}
