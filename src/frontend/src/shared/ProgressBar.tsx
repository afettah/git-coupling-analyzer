/**
 * ProgressBar Component
 * 
 * Visual progress indicator.
 */

import { cn } from '@/lib/utils';

export interface ProgressBarProps {
    value: number;
    max?: number;
    color?: 'default' | 'success' | 'warning' | 'danger';
    size?: 'sm' | 'md';
    showLabel?: boolean;
    className?: string;
}

const colorStyles = {
    default: 'bg-sky-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
};

const sizeStyles = {
    sm: 'h-1',
    md: 'h-1.5',
};

export function ProgressBar({
    value,
    max = 100,
    color = 'default',
    size = 'sm',
    showLabel = false,
    className,
}: ProgressBarProps) {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    return (
        <div className={cn('w-full', className)}>
            {showLabel && (
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>{Math.round(percentage)}%</span>
                </div>
            )}
            <div className={cn('bg-slate-800 rounded-full overflow-hidden', sizeStyles[size])}>
                <div
                    className={cn('h-full transition-all duration-500', colorStyles[color])}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}
