/**
 * Modal Component
 * 
 * Accessible modal dialog with keyboard handling.
 */

import { useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    className?: string;
}

const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-5xl',
    full: 'max-w-[95vw]',
};

export function Modal({
    open,
    onClose,
    title,
    subtitle,
    children,
    footer,
    size = 'lg',
    className,
}: ModalProps) {
    // Handle escape key
    useEffect(() => {
        if (!open) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [open, onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [open]);

    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    }, [onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={handleBackdropClick}
        >
            <div
                className={cn(
                    'bg-slate-900 border border-slate-800 rounded-2xl w-full max-h-[90vh] overflow-hidden flex flex-col',
                    sizeStyles[size],
                    className
                )}
            >
                {/* Header */}
                {(title || subtitle) && (
                    <div className="p-5 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
                        <div>
                            {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
                            {title && <h3 className="text-xl font-semibold text-slate-100">{title}</h3>}
                        </div>
                        <button
                            onClick={onClose}
                            className="text-slate-500 hover:text-slate-200 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-auto">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="p-4 border-t border-slate-800 flex justify-end gap-2 flex-shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
