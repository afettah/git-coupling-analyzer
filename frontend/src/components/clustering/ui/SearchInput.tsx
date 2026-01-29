/**
 * Search Input Component
 * 
 * Styled search input with icon and clear button.
 */

import { useCallback } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    size?: 'sm' | 'md';
    showClear?: boolean;
}

export function SearchInput({
    value,
    onChange,
    placeholder = 'Search...',
    className = '',
    size = 'sm',
    showClear = true
}: SearchInputProps) {
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    }, [onChange]);

    const handleClear = useCallback(() => {
        onChange('');
    }, [onChange]);

    const sizeClasses = size === 'sm'
        ? 'pl-8 pr-8 py-1.5 text-xs'
        : 'pl-9 pr-9 py-2 text-sm';

    const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

    return (
        <div className={`relative ${className}`}>
            <Search className={`${iconSize} text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none`} />
            <input
                type="text"
                value={value}
                onChange={handleChange}
                placeholder={placeholder}
                className={`w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500 ${sizeClasses}`}
            />
            {showClear && value && (
                <button
                    onClick={handleClear}
                    className={`${iconSize} text-slate-500 hover:text-slate-300 absolute right-2.5 top-1/2 -translate-y-1/2`}
                >
                    <X className={iconSize} />
                </button>
            )}
        </div>
    );
}

export default SearchInput;
