/**
 * Button Component
 * 
 * Consistent button styling with variants.
 */

import { forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: React.ReactNode;
    loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-sky-500 text-slate-900 hover:bg-sky-400 font-semibold',
    secondary: 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700',
    ghost: 'bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800',
    danger: 'bg-rose-600 text-white hover:bg-rose-500'
};

const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-2.5 py-1.5 text-xs rounded-lg',
    md: 'px-4 py-2 text-sm rounded-lg',
    lg: 'px-5 py-2.5 text-base rounded-xl'
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
    variant = 'secondary',
    size = 'sm',
    icon,
    loading,
    disabled,
    className = '',
    children,
    ...props
}, ref) => {
    const baseStyles = 'inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

    return (
        <button
            ref={ref}
            disabled={disabled || loading}
            className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
            {...props}
        >
            {loading ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : icon}
            {children}
        </button>
    );
});

Button.displayName = 'Button';

export default Button;
