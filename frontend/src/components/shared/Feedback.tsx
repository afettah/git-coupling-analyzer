/**
 * Feedback Components
 * 
 * Loading, empty state, and error display components.
 */

import { cn } from '@/lib/utils';

// ============================================================
// Spinner
// ============================================================

export interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const spinnerSizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-[3px]',
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
    return (
        <span
            className={cn(
                'inline-block border-current border-t-transparent rounded-full animate-spin',
                spinnerSizes[size],
                className
            )}
        />
    );
}

// ============================================================
// LoadingState
// ============================================================

export interface LoadingStateProps {
    message?: string;
    className?: string;
}

export function LoadingState({ message = 'Loading...', className }: LoadingStateProps) {
    return (
        <div className={cn('flex items-center gap-3 text-sm text-slate-500', className)}>
            <Spinner size="sm" />
            <span>{message}</span>
        </div>
    );
}

// ============================================================
// EmptyState
// ============================================================

export interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
    className?: string;
}

export function EmptyState({
    icon,
    title,
    description,
    action,
    className,
}: EmptyStateProps) {
    return (
        <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
            {icon && (
                <div className="text-slate-600 mb-4">
                    {icon}
                </div>
            )}
            <h3 className="text-lg font-medium text-slate-300">{title}</h3>
            {description && (
                <p className="text-sm text-slate-500 mt-1 max-w-md">{description}</p>
            )}
            {action && (
                <div className="mt-4">{action}</div>
            )}
        </div>
    );
}

// ============================================================
// ErrorBanner
// ============================================================

export interface ErrorBannerProps {
    title?: string;
    message: string;
    action?: React.ReactNode;
    className?: string;
}

export function ErrorBanner({
    title = 'Error',
    message,
    action,
    className,
}: ErrorBannerProps) {
    return (
        <div className={cn('bg-rose-500/10 border border-rose-500/30 rounded-xl p-4', className)}>
            <h4 className="text-rose-400 font-medium mb-1">{title}</h4>
            <p className="text-sm text-slate-300">{message}</p>
            {action && <div className="mt-3">{action}</div>}
        </div>
    );
}
