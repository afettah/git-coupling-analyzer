/**
 * Stat Card Component
 * 
 * Displays a metric with label in a compact card format.
 */

export interface StatCardProps {
    label: string;
    value: string | number;
    color?: 'default' | 'success' | 'warning' | 'danger' | 'info';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const colorStyles = {
    default: 'text-slate-100',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-rose-400',
    info: 'text-sky-400'
};

const sizeStyles = {
    sm: { value: 'text-lg', label: 'text-[10px]' },
    md: { value: 'text-2xl', label: 'text-xs' },
    lg: { value: 'text-3xl', label: 'text-sm' }
};

export function StatCard({
    label,
    value,
    color = 'default',
    size = 'sm',
    className = ''
}: StatCardProps) {
    return (
        <div className={`bg-slate-950 p-3 rounded-xl border border-slate-800 ${className}`}>
            <div className={`font-bold ${colorStyles[color]} ${sizeStyles[size].value}`}>
                {value}
            </div>
            <div className={`uppercase text-slate-500 ${sizeStyles[size].label}`}>
                {label}
            </div>
        </div>
    );
}

export default StatCard;
