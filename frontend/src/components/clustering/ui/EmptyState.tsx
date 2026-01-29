/**
 * Empty State Component
 * 
 * Consistent empty state display with optional action.
 */

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
    className = ''
}: EmptyStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
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

export default EmptyState;
