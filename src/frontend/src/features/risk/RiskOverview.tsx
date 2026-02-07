import { useEffect, useState } from 'react';
import { getRiskOverview, type RiskOverview as RiskOverviewType } from '@/api/risk';
import { Card } from '@/shared';
import { Shield, AlertTriangle, AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { getRiskColor, formatRiskScore } from '@/types/risk';

interface RiskOverviewProps {
    repoId: string;
}

export default function RiskOverview({ repoId }: RiskOverviewProps) {
    const [overview, setOverview] = useState<RiskOverviewType | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOverview = async () => {
            try {
                const data = await getRiskOverview(repoId);
                setOverview(data);
            } catch (error) {
                console.error('Failed to fetch risk overview:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchOverview();
    }, [repoId]);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-48 bg-slate-800/50 rounded-lg" />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="h-32 bg-slate-800/50 rounded-lg" />
                        <div className="h-32 bg-slate-800/50 rounded-lg" />
                    </div>
                </div>
            </div>
        );
    }

    if (!overview) {
        return (
            <Card className="p-12 text-center">
                <p className="text-slate-400">No risk data available</p>
            </Card>
        );
    }

    const getGaugeColor = (score: number) => {
        if (score >= 7) return '#ef4444';
        if (score >= 5) return '#f97316';
        if (score >= 3) return '#eab308';
        return '#22c55e';
    };

    const scorePercentage = (overview.overall_score / 10) * 100;

    return (
        <div className="space-y-6">
            {/* Overall Risk Score */}
            <Card className="p-8">
                <div className="flex items-center justify-between gap-8">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                            <Shield className="w-8 h-8 text-sky-400" />
                            <div>
                                <h2 className="text-2xl font-bold text-slate-200">Overall Risk Score</h2>
                                <p className="text-sm text-slate-400 mt-1">Composite risk across all categories</p>
                            </div>
                        </div>

                        {/* Risk breakdown */}
                        <div className="grid grid-cols-2 gap-4 mt-6">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-400" />
                                <div>
                                    <div className="text-sm text-slate-400">High Risk</div>
                                    <div className="text-2xl font-bold text-red-400">{overview.high_risk_count}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-orange-400" />
                                <div>
                                    <div className="text-sm text-slate-400">Medium Risk</div>
                                    <div className="text-2xl font-bold text-orange-400">{overview.medium_risk_count}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Gauge */}
                    <div className="relative w-48 h-48">
                        <svg viewBox="0 0 200 200" className="w-full h-full">
                            {/* Background arc */}
                            <path
                                d="M 30 170 A 85 85 0 1 1 170 170"
                                fill="none"
                                stroke="#1e293b"
                                strokeWidth="20"
                                strokeLinecap="round"
                            />
                            {/* Colored arc */}
                            <path
                                d="M 30 170 A 85 85 0 1 1 170 170"
                                fill="none"
                                stroke={getGaugeColor(overview.overall_score)}
                                strokeWidth="20"
                                strokeLinecap="round"
                                strokeDasharray={`${(scorePercentage / 100) * 267} 267`}
                                style={{ transition: 'stroke-dasharray 1s ease' }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center mt-8">
                                <div
                                    className="text-5xl font-bold"
                                    style={{ color: getGaugeColor(overview.overall_score) }}
                                >
                                    {formatRiskScore(overview.overall_score)}
                                </div>
                                <div className="text-sm text-slate-500 mt-1">/ 10</div>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Category Scores */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                            <TrendingUp className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">Coupling</div>
                            <div className="text-xl font-bold text-slate-200">
                                {formatRiskScore(overview.category_scores.coupling)}
                            </div>
                        </div>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                        <div
                            className="h-2 rounded-full transition-all"
                            style={{
                                width: `${(overview.category_scores.coupling / 10) * 100}%`,
                                backgroundColor: getRiskColor(overview.category_scores.coupling),
                            }}
                        />
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                            <TrendingDown className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">Dependency</div>
                            <div className="text-xl font-bold text-slate-200">
                                {formatRiskScore(overview.category_scores.dependency)}
                            </div>
                        </div>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                        <div
                            className="h-2 rounded-full transition-all"
                            style={{
                                width: `${(overview.category_scores.dependency / 10) * 100}%`,
                                backgroundColor: getRiskColor(overview.category_scores.dependency),
                            }}
                        />
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                            <AlertCircle className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">Churn</div>
                            <div className="text-xl font-bold text-slate-200">
                                {formatRiskScore(overview.category_scores.churn)}
                            </div>
                        </div>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                        <div
                            className="h-2 rounded-full transition-all"
                            style={{
                                width: `${(overview.category_scores.churn / 10) * 100}%`,
                                backgroundColor: getRiskColor(overview.category_scores.churn),
                            }}
                        />
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                            <Shield className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">Semantic</div>
                            <div className="text-xl font-bold text-slate-200">
                                {formatRiskScore(overview.category_scores.semantic)}
                            </div>
                        </div>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                        <div
                            className="h-2 rounded-full transition-all"
                            style={{
                                width: `${(overview.category_scores.semantic / 10) * 100}%`,
                                backgroundColor: getRiskColor(overview.category_scores.semantic),
                            }}
                        />
                    </div>
                </Card>
            </div>

            {/* Distribution */}
            {overview.distribution.length > 0 && (
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4">Risk Distribution</h3>
                    <div className="flex items-end gap-2 h-32">
                        {overview.distribution.map((bucket) => {
                            const maxCount = Math.max(...overview.distribution.map(b => b.count));
                            const heightPercent = (bucket.count / maxCount) * 100;

                            return (
                                <div key={bucket.bucket} className="flex-1 flex flex-col items-center gap-2">
                                    <div
                                        className="w-full rounded-t-lg transition-all relative group"
                                        style={{
                                            height: `${heightPercent}%`,
                                            backgroundColor: getRiskColor(parseFloat(bucket.bucket)),
                                            minHeight: bucket.count > 0 ? '8px' : '0',
                                        }}
                                    >
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium text-slate-200">
                                            {bucket.count}
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500">{bucket.bucket}</div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}
        </div>
    );
}
