/**
 * Card Component
 * 
 * Flexible card container with compound components.
 */

import { cn } from '@/lib/utils';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    interactive?: boolean;
    onClick?: () => void;
}

export function Card({ children, className, interactive, onClick }: CardProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                'bg-slate-900 border border-slate-800 rounded-2xl',
                interactive && 'cursor-pointer hover:border-sky-500/50 hover:shadow-2xl hover:shadow-sky-500/10 hover:-translate-y-1 transition-all',
                className
            )}
        >
            {children}
        </div>
    );
}

interface CardHeaderProps {
    children: React.ReactNode;
    className?: string;
}

Card.Header = function CardHeader({ children, className }: CardHeaderProps) {
    return (
        <div className={cn('p-5 border-b border-slate-800 flex items-center justify-between', className)}>
            {children}
        </div>
    );
};

interface CardTitleProps {
    children: React.ReactNode;
    subtitle?: string;
    className?: string;
}

Card.Title = function CardTitle({ children, subtitle, className }: CardTitleProps) {
    return (
        <div className={className}>
            {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
            <h3 className="text-xl font-semibold text-slate-100">{children}</h3>
        </div>
    );
};

interface CardActionsProps {
    children: React.ReactNode;
    className?: string;
}

Card.Actions = function CardActions({ children, className }: CardActionsProps) {
    return (
        <div className={cn('flex items-center gap-2', className)}>
            {children}
        </div>
    );
};

interface CardBodyProps {
    children: React.ReactNode;
    className?: string;
    noPadding?: boolean;
}

Card.Body = function CardBody({ children, className, noPadding }: CardBodyProps) {
    return (
        <div className={cn(!noPadding && 'p-5', className)}>
            {children}
        </div>
    );
};

interface CardFooterProps {
    children: React.ReactNode;
    className?: string;
}

Card.Footer = function CardFooter({ children, className }: CardFooterProps) {
    return (
        <div className={cn('p-4 border-t border-slate-800 flex justify-end gap-2', className)}>
            {children}
        </div>
    );
};

interface CardStatsProps {
    items: Array<{ label: string; value: string | number }>;
    className?: string;
}

Card.Stats = function CardStats({ items, className }: CardStatsProps) {
    return (
        <div className={cn('flex items-center gap-4', className)}>
            {items.map((item) => (
                <div key={item.label} className="text-xs">
                    <span className="text-slate-500">{item.label}:</span>{' '}
                    <span className="text-slate-200 font-medium">{item.value}</span>
                </div>
            ))}
        </div>
    );
};
