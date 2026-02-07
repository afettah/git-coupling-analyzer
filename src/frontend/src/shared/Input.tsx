/**
 * Input Components
 * 
 * Text, number, and search input components.
 */

import { useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// TextInput
// ============================================================

export interface TextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    size?: 'sm' | 'md';
}

const inputSizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
};

export function TextInput({
    value,
    onChange,
    label,
    size = 'sm',
    className,
    ...props
}: TextInputProps) {
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    }, [onChange]);

    return (
        <div className={cn('flex flex-col gap-1', className)}>
            {label && <label className="text-xs text-slate-500">{label}</label>}
            <input
                type="text"
                value={value}
                onChange={handleChange}
                className={cn(
                    'bg-slate-950 border border-slate-800 rounded-lg text-slate-200',
                    'focus:outline-none focus:border-sky-500',
                    inputSizeStyles[size]
                )}
                {...props}
            />
        </div>
    );
}

// ============================================================
// NumberInput
// ============================================================

export interface NumberInputProps {
    value: number;
    onChange: (value: number) => void;
    label?: string;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
    width?: string;
    disabled?: boolean;
}

export function NumberInput({
    value,
    onChange,
    label,
    min,
    max,
    step = 1,
    className,
    width = 'w-16',
    disabled = false,
}: NumberInputProps) {
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = Number(e.target.value);
        if (!isNaN(newValue)) {
            onChange(newValue);
        }
    }, [onChange]);

    return (
        <div className={cn('flex items-center gap-2', className)}>
            {label && <label className="text-xs text-slate-500">{label}</label>}
            <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={handleChange}
                disabled={disabled}
                className={cn(
                    'bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200',
                    'focus:outline-none focus:border-sky-500',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    width
                )}
            />
        </div>
    );
}

// ============================================================
// SearchInput
// ============================================================

export interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    size?: 'sm' | 'md';
    showClear?: boolean;
}

const searchSizeStyles = {
    sm: { input: 'pl-8 pr-8 py-1.5 text-xs', icon: 'w-3.5 h-3.5' },
    md: { input: 'pl-9 pr-9 py-2 text-sm', icon: 'w-4 h-4' },
};

export function SearchInput({
    value,
    onChange,
    placeholder = 'Search...',
    className,
    size = 'sm',
    showClear = true,
}: SearchInputProps) {
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    }, [onChange]);

    const handleClear = useCallback(() => {
        onChange('');
    }, [onChange]);

    const styles = searchSizeStyles[size];

    return (
        <div className={cn('relative', className)}>
            <Search className={cn(styles.icon, 'text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none')} />
            <input
                type="text"
                value={value}
                onChange={handleChange}
                placeholder={placeholder}
                className={cn(
                    'w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200',
                    'focus:outline-none focus:border-sky-500',
                    styles.input
                )}
            />
            {showClear && value && (
                <button
                    onClick={handleClear}
                    className={cn(styles.icon, 'text-slate-500 hover:text-slate-300 absolute right-2.5 top-1/2 -translate-y-1/2')}
                >
                    <X className={styles.icon} />
                </button>
            )}
        </div>
    );
}
