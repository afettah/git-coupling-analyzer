import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCircularDeps, type CircularDep } from '@/api/deps';
import { Card, Badge } from '@/shared';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { getCycleSeverity, getSeverityColor } from '@/types/deps';

interface CircularDepsProps {
    repoId: string;
}

export default function CircularDeps({ repoId }: CircularDepsProps) {
    const [cycles, setCycles] = useState<CircularDep[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedCycles, setExpandedCycles] = useState<Set<number>>(new Set());
    const navigate = useNavigate();

    useEffect(() => {
        const fetchCycles = async () => {
            try {
                const data = await getCircularDeps(repoId);
                setCycles(data);
            } catch (error) {
                console.error('Failed to fetch circular dependencies:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchCycles();
    }, [repoId]);

    const toggleExpand = (cycleId: number) => {
        setExpandedCycles(prev => {
            const next = new Set(prev);
            if (next.has(cycleId)) {
                next.delete(cycleId);
            } else {
                next.add(cycleId);
            }
            return next;
        });
    };

    const getSeverityBadgeClass = (severity: 'low' | 'medium' | 'high') => {
        switch (severity) {
            case 'high':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'medium':
                return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'low':
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        }
    };

    if (loading) {
        return (
            <Card className="p-6">
                <div className="animate-pulse space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-24 bg-slate-800/50 rounded-lg" />
                    ))}
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-slate-200">
                        Circular Dependencies
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">
                        {cycles.length} cycle{cycles.length !== 1 ? 's' : ''} detected
                    </p>
                </div>
                {cycles.length > 0 && (
                    <div className="flex items-center gap-2 text-orange-400">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="text-sm font-medium">Requires attention</span>
                    </div>
                )}
            </div>

            {cycles.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No circular dependencies detected!</p>
                    <p className="text-sm mt-2">Your dependency graph is acyclic.</p>
                </div>
            ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {cycles.map((cycle) => {
                        const severity = getCycleSeverity(cycle.cycle_length);
                        const isExpanded = expandedCycles.has(cycle.cycle_id);

                        return (
                            <div
                                key={cycle.cycle_id}
                                className="border border-slate-800 rounded-lg overflow-hidden hover:border-slate-700 transition-colors"
                            >
                                <button
                                    onClick={() => toggleExpand(cycle.cycle_id)}
                                    className="w-full p-4 bg-slate-900/50 hover:bg-slate-900 transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="p-2 rounded-lg"
                                                style={{
                                                    backgroundColor: `${getSeverityColor(severity)}20`,
                                                    borderColor: `${getSeverityColor(severity)}40`,
                                                    border: '1px solid',
                                                }}
                                            >
                                                <AlertTriangle
                                                    className="w-5 h-5"
                                                    style={{ color: getSeverityColor(severity) }}
                                                />
                                            </div>
                                            <div className="text-left">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-slate-200">
                                                        Cycle #{cycle.cycle_id}
                                                    </span>
                                                    <Badge className={getSeverityBadgeClass(severity)}>
                                                        {severity}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    {cycle.cycle_length} files in cycle
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronRight
                                            className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''
                                                }`}
                                        />
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="p-4 bg-slate-950/50 border-t border-slate-800">
                                        <div className="space-y-2">
                                            {cycle.cycle_path.map((path, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-xs text-slate-400">
                                                        {index + 1}
                                                    </div>
                                                    <button
                                                        onClick={() =>
                                                            navigate(
                                                                `/repos/${repoId}/git/files/${encodeURIComponent(
                                                                    path
                                                                )}`
                                                            )
                                                        }
                                                        className="flex-1 text-left px-3 py-2 bg-slate-900/50 rounded-lg border border-slate-800 hover:border-sky-500/50 hover:bg-slate-900 transition-all group"
                                                    >
                                                        <p className="text-sm text-slate-300 group-hover:text-sky-400 transition-colors truncate">
                                                            {path}
                                                        </p>
                                                    </button>
                                                    {index < cycle.cycle_path.length - 1 && (
                                                        <ChevronRight className="w-4 h-4 text-slate-600" />
                                                    )}
                                                </div>
                                            ))}
                                            {/* Show arrow back to first file */}
                                            <div className="flex items-center gap-2">
                                                <div className="w-6" />
                                                <div className="flex-1 flex items-center gap-2 text-xs text-slate-500">
                                                    <div className="flex-1 border-t-2 border-dashed border-slate-700" />
                                                    <span>cycle completes</span>
                                                    <ChevronRight className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
}
