/**
 * Loading Spinner Component
 */

export interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizeStyles = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3'
};

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
    return (
        <span
            className={`inline-block border-current border-t-transparent rounded-full animate-spin ${sizeStyles[size]} ${className}`}
        />
    );
}

export interface LoadingStateProps {
    message?: string;
    className?: string;
}

export function LoadingState({ message = 'Loading...', className = '' }: LoadingStateProps) {
    return (
        <div className={`flex items-center gap-3 text-sm text-slate-500 ${className}`}>
            <Spinner size="sm" />
            <span>{message}</span>
        </div>
    );
}

export default Spinner;
