/**
 * CouplingLegend Component
 * 
 * Visual legend showing coupling strength color mapping.
 */

import { colors, COUPLING_THRESHOLDS } from '@/design-tokens';
import { cn } from '@/lib/utils';

export interface CouplingLegendProps {
    className?: string;
    compact?: boolean;
}

const items = [
    { label: 'High (80%+)', color: colors.coupling.veryHigh },
    { label: 'Medium (60-80%)', color: colors.coupling.high },
    { label: 'Low (40-60%)', color: colors.coupling.medium },
    { label: 'Very low (<40%)', color: colors.coupling.low },
];

export function CouplingLegend({ className, compact = false }: CouplingLegendProps) {
    if (compact) {
        return (
            <div className={cn('flex items-center gap-3 text-xs text-slate-400', className)}>
                {items.map(item => (
                    <span key={item.color} className="flex items-center gap-1">
                        <span
                            className="w-2.5 h-2.5 rounded-sm"
                            style={{ backgroundColor: item.color }}
                        />
                        {item.label}
                    </span>
                ))}
            </div>
        );
    }

    return (
        <div className={cn('flex items-center gap-2 text-xs text-slate-400', className)}>
            {items.map(item => (
                <span key={item.color} className="flex items-center gap-1.5">
                    <span
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                    />
                    <span>{item.label}</span>
                </span>
            ))}
        </div>
    );
}

// Re-export for convenience
export { COUPLING_THRESHOLDS };
