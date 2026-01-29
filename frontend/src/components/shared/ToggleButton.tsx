/**
 * ToggleButton Component
 * 
 * Button that toggles between active/inactive states.
 */

import { cn } from '@/lib/utils';

export interface ToggleButtonProps {
    active: boolean;
    onToggle: () => void;
    icon?: React.ReactNode;
    label: string;
    title?: string;
    className?: string;
}

export function ToggleButton({
    active,
    onToggle,
    icon,
    label,
    title,
    className,
}: ToggleButtonProps) {
    return (
        <button
            onClick={onToggle}
            title={title}
            className={cn(
                'flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-lg transition-colors',
                active
                    ? 'bg-slate-700 text-slate-200'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800',
                className
            )}
        >
            {icon}
            {label}
        </button>
    );
}
