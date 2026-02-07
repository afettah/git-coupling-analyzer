import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, AlertCircle, TrendingUp } from 'lucide-react';
import { getRiskFiles, type RiskScore } from '@/api/risk';
import Card from '@/shared/Card';
import Badge from '@/shared/Badge';
import { getRiskColor, formatRiskScore } from '@/types/risk';

interface RiskSignalsWidgetProps {
    repoId: string;
    limit?: number;
}

export default function RiskSignalsWidget({ repoId, limit = 5 }: RiskSignalsWidgetProps) {
    const [risks, setRisks] = useState<RiskScore[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchRisks = async () => {
            try {
                const data = await getRiskFiles(repoId, {
                    sort_by: 'overall_risk',
                    order: 'desc',
                    limit,
                });
                setRisks(data);
            } catch (error) {
                console.error('Failed to fetch risk data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchRisks();
    }, [repoId, limit]);

    const getRiskIcon = (score: number) => {
        if (score >= 7) return <AlertTriangle className="w-4 h-4 text-red-400" />;
        if (score >= 5) return <AlertCircle className="w-4 h-4 text-orange-400" />;
        return <TrendingUp className="w-4 h-4 text-yellow-400" />;
    };

    if (loading) {
        return (
            <Card className="p-6">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Top Risk Files</h3>
                <div className="space-y-3">
                    {[...Array(limit)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                            <div className="h-16 bg-slate-800/50 rounded-lg" />
                        </div>
                    ))}
                </div>
            </Card>
        );
    }

    if (risks.length === 0) {
        return (
            <Card className="p-6">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Top Risk Files</h3>
                <p className="text-slate-400 text-sm text-center py-8">
                    No risk data available. Run the analyzers first.
                </p>
            </Card>
        );
    }

    return (
        <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-200">Top Risk Files</h3>
                <button
                    onClick={() => navigate(`/repos/${repoId}/risk`)}
                    className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                >
                    View all →
                </button>
            </div>
            <div className="space-y-2">
                {risks.map((risk) => (
                    <button
                        key={risk.entity_id}
                        onClick={() => navigate(`/repos/${repoId}/git/files/${encodeURIComponent(risk.path)}`)}
                        className="w-full text-left p-3 bg-slate-900/50 rounded-lg border border-slate-800 hover:border-slate-700 hover:bg-slate-900 transition-all group"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    {getRiskIcon(risk.overall_risk)}
                                    <span className="text-sm font-medium text-slate-200 truncate group-hover:text-sky-400 transition-colors">
                                        {risk.path.split('/').pop()}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 truncate">{risk.path}</p>
                                {risk.signals.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {risk.signals.slice(0, 2).map((signal, i) => (
                                            <Badge
                                                key={i}
                                                className="text-xs bg-slate-800/50 text-slate-400 border-slate-700"
                                            >
                                                {signal.description}
                                            </Badge>
                                        ))}
                                        {risk.signals.length > 2 && (
                                            <Badge className="text-xs bg-slate-800/50 text-slate-400 border-slate-700">
                                                +{risk.signals.length - 2} more
                                            </Badge>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div
                                className="flex items-center justify-center w-12 h-12 rounded-lg font-bold text-sm shrink-0"
                                style={{
                                    backgroundColor: `${getRiskColor(risk.overall_risk)}20`,
                                    color: getRiskColor(risk.overall_risk),
                                    border: `1px solid ${getRiskColor(risk.overall_risk)}40`,
                                }}
                            >
                                {formatRiskScore(risk.overall_risk)}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </Card>
    );
}
