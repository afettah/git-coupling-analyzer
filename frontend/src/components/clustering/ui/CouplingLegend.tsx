/**
 * Coupling Legend Component
 * 
 * Visual legend showing coupling strength color mapping.
 */

import { COUPLING_COLORS } from '../constants';

export interface CouplingLegendProps {
    className?: string;
    compact?: boolean;
}

export function CouplingLegend({ className = '', compact = false }: CouplingLegendProps) {
    const items = [
        { label: 'High (80%+)', color: COUPLING_COLORS.veryHigh.color },
        { label: 'Medium (60-80%)', color: COUPLING_COLORS.high.color },
        { label: 'Low (40-60%)', color: COUPLING_COLORS.medium.color },
        { label: 'Very low (<40%)', color: COUPLING_COLORS.low.color }
    ];

    if (compact) {
        return (
            <div className={`flex items-center gap-3 text-xs text-slate-400 ${className}`}>
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
        <div className={`flex items-center gap-2 text-xs text-slate-400 ${className}`}>
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

export default CouplingLegend;
