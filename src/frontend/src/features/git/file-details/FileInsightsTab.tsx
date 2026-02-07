/**
 * FileInsightsTab Component
 * 
 * Health score and risk analysis with recommendations.
 */

import { type FileDetailsResponse, type CoupledFile } from '../../../api/git';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle, Info, TrendingUp, TrendingDown, Shield, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface FileInsightsTabProps {
    details: FileDetailsResponse;
    coupling: CoupledFile[];
}

// Health score bar component
function HealthScoreBar({ score, label, max = 100 }: { score: number; label: string; max?: number }) {
    const percentage = (score / max) * 100;
    let colorClass = 'bg-emerald-500';
    if (score < 40) colorClass = 'bg-red-500';
    else if (score < 70) colorClass = 'bg-amber-500';

    return (
        <div className="flex items-center gap-3">
            <span className="w-24 text-xs text-slate-400">{label}</span>
            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                    className={cn('h-full rounded-full transition-all', colorClass)}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <span className="w-8 text-xs text-slate-300 text-right">{score}</span>
        </div>
    );
}

// Risk indicator component
function RiskIndicator({
    level,
    title,
    description
}: {
    level: 'low' | 'medium' | 'high';
    title: string;
    description: string;
}) {
    const config = {
        low: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
        medium: { icon: Info, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
        high: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
    }[level];

    const Icon = config.icon;

    return (
        <div className={cn('p-3 rounded-lg border', config.bg, config.border)}>
            <div className="flex items-start gap-2">
                <Icon size={16} className={cn('mt-0.5 flex-shrink-0', config.color)} />
                <div>
                    <div className={cn('text-sm font-medium', config.color)}>{title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{description}</div>
                </div>
            </div>
        </div>
    );
}

// Recommendation component
function Recommendation({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
            <div className="p-1.5 bg-sky-500/10 rounded text-sky-400">
                {icon}
            </div>
            <div>
                <div className="text-sm font-medium text-slate-200">{title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{description}</div>
            </div>
        </div>
    );
}

// Trend indicator component
function TrendIndicator({
    label,
    currentValue,
    trend,
    trendLabel,
    format = 'number',
    invertColors = false
}: {
    label: string;
    currentValue: number;
    trend: 'up' | 'down' | 'stable';
    trendLabel: string;
    format?: 'number' | 'percent';
    invertColors?: boolean; // For metrics where "up" is bad (like churn)
}) {
    const displayValue = format === 'percent'
        ? `${Math.round(currentValue)}%`
        : currentValue.toLocaleString();

    // Determine colors based on trend and inversion
    let TrendIcon = Minus;
    let trendColor = 'text-slate-400';
    let trendBg = 'bg-slate-500/10';

    if (trend === 'up') {
        TrendIcon = ArrowUpRight;
        if (invertColors) {
            trendColor = 'text-red-400';
            trendBg = 'bg-red-500/10';
        } else {
            trendColor = 'text-emerald-400';
            trendBg = 'bg-emerald-500/10';
        }
    } else if (trend === 'down') {
        TrendIcon = ArrowDownRight;
        if (invertColors) {
            trendColor = 'text-emerald-400';
            trendBg = 'bg-emerald-500/10';
        } else {
            trendColor = 'text-red-400';
            trendBg = 'bg-red-500/10';
        }
    }

    return (
        <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
            <div>
                <div className="text-xs text-slate-500 mb-1">{label}</div>
                <div className="text-lg font-semibold text-slate-200">{displayValue}</div>
            </div>
            <div className={cn('flex items-center gap-1 px-2 py-1 rounded text-xs font-medium', trendBg, trendColor)}>
                <TrendIcon size={14} />
                <span>{trendLabel}</span>
            </div>
        </div>
    );
}

export function FileInsightsTab({ details, coupling }: FileInsightsTabProps) {
    // Calculate sub-scores
    const stabilityScore = Math.min(100, Math.max(0, 100 - (details.commits_last_30_days * 5)));
    const ownershipScore = details.authors_count <= 2 ? 100 :
        details.authors_count <= 5 ? 70 :
            details.authors_count <= 10 ? 40 : 20;
    const couplingScore = details.max_coupling < 0.3 ? 100 :
        details.max_coupling < 0.5 ? 70 :
            details.max_coupling < 0.7 ? 40 : 20;
    const sizeScore = Math.max(0, 100 - (details.total_lines_added / 100));

    const overallScore = Math.round((stabilityScore + ownershipScore + couplingScore + sizeScore) / 4);

    // Determine overall status
    const statusConfig = overallScore >= 70
        ? { label: 'Good', color: 'text-emerald-400', icon: '🟢' }
        : overallScore >= 40
            ? { label: 'Moderate', color: 'text-amber-400', icon: '🟡' }
            : { label: 'At Risk', color: 'text-red-400', icon: '🔴' };

    // Build risk indicators
    const risks: Array<{ level: 'low' | 'medium' | 'high'; title: string; description: string }> = [];

    if (details.commits_last_30_days > 10) {
        risks.push({
            level: 'high',
            title: 'High churn rate',
            description: `${details.commits_last_30_days} changes in the last 30 days indicate frequent modifications`
        });
    } else if (details.commits_last_30_days > 5) {
        risks.push({
            level: 'medium',
            title: 'Moderate churn',
            description: `${details.commits_last_30_days} changes in the last 30 days`
        });
    }

    if (details.authors_count > 5) {
        risks.push({
            level: 'medium',
            title: 'Multiple authors',
            description: `${details.authors_count} contributors may indicate unclear ownership`
        });
    }

    if (details.max_coupling > 0.7) {
        risks.push({
            level: 'high',
            title: 'High coupling',
            description: `Strong dependency with ${details.strong_coupling_count} files (max ${Math.round(details.max_coupling * 100)}%)`
        });
    } else if (details.max_coupling > 0.5) {
        risks.push({
            level: 'medium',
            title: 'Moderate coupling',
            description: `Connected to ${details.coupled_files_count} files with ${Math.round(details.max_coupling * 100)}% max coupling`
        });
    }

    // Check for test file coupling
    const hasTestCoupling = coupling.some(c =>
        c.path.includes('test') || c.path.includes('spec') || c.path.includes('__tests__')
    );

    if (!hasTestCoupling && details.total_commits > 10) {
        risks.push({
            level: 'medium',
            title: 'No test coupling detected',
            description: 'This file may not have associated test files'
        });
    }

    if (risks.length === 0) {
        risks.push({
            level: 'low',
            title: 'No significant risks detected',
            description: 'This file appears to be in good health'
        });
    }

    // Build recommendations
    const recommendations: Array<{ icon: React.ReactNode; title: string; description: string }> = [];

    if (details.authors_count > 5) {
        recommendations.push({
            icon: <Shield size={14} />,
            title: 'Establish code ownership',
            description: 'Consider assigning a primary maintainer to improve consistency'
        });
    }

    if (details.max_coupling > 0.5 && coupling.length > 5) {
        recommendations.push({
            icon: <TrendingDown size={14} />,
            title: 'Consider refactoring',
            description: 'High coupling suggests this file might benefit from being split into smaller modules'
        });
    }

    if (!hasTestCoupling && details.total_commits > 10) {
        recommendations.push({
            icon: <CheckCircle size={14} />,
            title: 'Add test coverage',
            description: 'No tests detected for this frequently-changed file'
        });
    }

    if (details.churn_rate > 5) {
        recommendations.push({
            icon: <TrendingUp size={14} />,
            title: 'Investigate frequent changes',
            description: 'High churn rate may indicate design issues or scope creep'
        });
    }

    // Calculate trends
    // Activity trend: Compare recent activity to historical average
    const fileAgeMonths = details.first_commit_date
        ? Math.max(1, Math.round((Date.now() - new Date(details.first_commit_date).getTime()) / (30 * 24 * 60 * 60 * 1000)))
        : 1;
    const avgCommitsPerMonth = details.total_commits / fileAgeMonths;
    const recentActivity = details.commits_last_30_days;
    const activityRatio = avgCommitsPerMonth > 0 ? recentActivity / avgCommitsPerMonth : 0;

    const activityTrend = activityRatio > 1.5 ? 'up' : activityRatio < 0.5 ? 'down' : 'stable';
    const activityTrendLabel = activityRatio > 1.5
        ? `${Math.round((activityRatio - 1) * 100)}% more active`
        : activityRatio < 0.5
            ? `${Math.round((1 - activityRatio) * 100)}% less active`
            : 'Normal activity';

    // Churn trend: Is the file becoming more volatile?
    const churnTrend = details.churn_rate > 5 ? 'up' : details.churn_rate < 2 ? 'down' : 'stable';
    const churnTrendLabel = details.churn_rate > 5
        ? 'High churn'
        : details.churn_rate < 2
            ? 'Stable'
            : 'Moderate';

    // Coupling trend: Based on current coupling level
    const couplingTrend = details.max_coupling > 0.7 ? 'up' : details.max_coupling < 0.3 ? 'down' : 'stable';
    const couplingTrendLabel = details.max_coupling > 0.7
        ? 'Tightly coupled'
        : details.max_coupling < 0.3
            ? 'Loosely coupled'
            : 'Normal';

    return (
        <div className="p-4 space-y-6">
            {/* Overall health score */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-300">📊 Health Score</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-slate-100">{overallScore}/100</span>
                        <span className={cn('text-sm', statusConfig.color)}>
                            {statusConfig.icon} {statusConfig.label}
                        </span>
                    </div>
                </div>

                {/* Score breakdown */}
                <div className="space-y-2">
                    <HealthScoreBar score={stabilityScore} label="Stability" />
                    <HealthScoreBar score={ownershipScore} label="Ownership" />
                    <HealthScoreBar score={couplingScore} label="Coupling" />
                    <HealthScoreBar score={Math.round(sizeScore)} label="Size" />
                </div>
            </div>

            {/* Risk indicators */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">⚠️ Risk Indicators</h3>
                <div className="space-y-2">
                    {risks.map((risk, i) => (
                        <RiskIndicator key={i} {...risk} />
                    ))}
                </div>
            </div>

            {/* Recommendations */}
            {recommendations.length > 0 && (
                <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                    <h3 className="text-sm font-semibold text-slate-300 mb-4">💡 Recommendations</h3>
                    <div className="space-y-2">
                        {recommendations.map((rec, i) => (
                            <Recommendation key={i} {...rec} />
                        ))}
                    </div>
                </div>
            )}

            {/* Trends */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">📈 Trends</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <TrendIndicator
                        label="Recent Activity"
                        currentValue={recentActivity}
                        trend={activityTrend}
                        trendLabel={activityTrendLabel}
                        invertColors={true}
                    />
                    <TrendIndicator
                        label="Churn Rate"
                        currentValue={Math.round(details.churn_rate * 10) / 10}
                        trend={churnTrend}
                        trendLabel={churnTrendLabel}
                        invertColors={true}
                    />
                    <TrendIndicator
                        label="Max Coupling"
                        currentValue={Math.round(details.max_coupling * 100)}
                        trend={couplingTrend}
                        trendLabel={couplingTrendLabel}
                        format="percent"
                        invertColors={true}
                    />
                </div>
                <p className="text-xs text-slate-500 mt-3">
                    Comparing recent (30 days) to historical average ({fileAgeMonths} months of history)
                </p>
            </div>

            {/* Quick stats summary */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">📋 Summary Stats</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Total commits</span>
                        <span className="text-slate-300">{details.total_commits}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Recent (30d)</span>
                        <span className="text-slate-300">{details.commits_last_30_days}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Total authors</span>
                        <span className="text-slate-300">{details.authors_count}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Top author</span>
                        <span className="text-slate-300">{details.top_author || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Coupled files</span>
                        <span className="text-slate-300">{details.coupled_files_count}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Strong couplings</span>
                        <span className="text-slate-300">{details.strong_coupling_count}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Lines added</span>
                        <span className="text-emerald-400">+{details.total_lines_added.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Lines deleted</span>
                        <span className="text-red-400">-{details.total_lines_deleted.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default FileInsightsTab;
