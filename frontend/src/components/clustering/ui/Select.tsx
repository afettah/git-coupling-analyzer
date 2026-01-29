/**
 * Select Component
 * 
 * Styled select dropdown with consistent design.
 */

import { useCallback } from 'react';

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
}

export function Select<T extends string = string>({
    value,
    onChange,
    options,
    label,
    className = '',
    size = 'sm'
}: SelectProps<T>) {
    const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(e.target.value as T);
    }, [onChange]);

    const sizeClasses = size === 'sm'
        ? 'px-2 py-1 text-xs'
        : 'px-3 py-1.5 text-sm';

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {label && <label className="text-xs text-slate-500">{label}</label>}
            <select
                value={value}
                onChange={handleChange}
                className={`bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-sky-500 ${sizeClasses}`}
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

export default Select;
