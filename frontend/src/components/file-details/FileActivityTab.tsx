/**
 * FileActivityTab Component
 * 
 * Activity charts for file: timeline, heatmap, and day/hour matrix.
 */

import { useState, useEffect, useMemo } from 'react';
import { getFileActivity, type FileActivityResponse } from '../../api';
import { Spinner } from '../shared';
import { cn } from '@/lib/utils';

interface FileActivityTabProps {
    repoId: string;
    filePath: string;
}

type Granularity = 'daily' | 'weekly' | 'monthly' | 'quarterly';
type MetricType = 'commits' | 'lines' | 'authors';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function FileActivityTab({ repoId, filePath }: FileActivityTabProps) {
    const [data, setData] = useState<FileActivityResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [granularity, setGranularity] = useState<Granularity>('monthly');
    const [metricType, setMetricType] = useState<MetricType>('commits');
    const [selectedYear, setSelectedYear] = useState<string>('all');

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const result = await getFileActivity(repoId, filePath, granularity);
                setData(result);
            } catch (e) {
                console.error('Failed to load activity data:', e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [repoId, filePath, granularity]);

    // Get available years from heatmap data
    const availableYears = useMemo(() => {
        if (!data?.heatmap_data) return [];
        const years = new Set(data.heatmap_data.map(d => d.date.split('-')[0]));
        return Array.from(years).sort().reverse();
    }, [data]);

    // Filter heatmap data by year
    const filteredHeatmapData = useMemo(() => {
        if (!data?.heatmap_data) return [];
        if (selectedYear === 'all') return data.heatmap_data;
        return data.heatmap_data.filter(d => d.date.startsWith(selectedYear));
    }, [data, selectedYear]);

    // Calculate max value for scaling
    const maxCommitCount = useMemo(() => {
        if (!data?.commits_by_period) return 1;
        return Math.max(1, ...data.commits_by_period.map(d => d.count));
    }, [data]);

    const maxLinesChanged = useMemo(() => {
        if (!data?.lines_by_period) return 1;
        return Math.max(1, ...data.lines_by_period.map(d => d.added + d.deleted));
    }, [data]);

    const maxHeatmapValue = useMemo(() => {
        if (!filteredHeatmapData.length) return 1;
        return Math.max(1, ...filteredHeatmapData.map(d => d.count));
    }, [filteredHeatmapData]);

    const maxDayHourValue = useMemo(() => {
        if (!data?.day_hour_matrix) return 1;
        let max = 1;
        data.day_hour_matrix.forEach(d => {
            d.hours.forEach(h => {
                if (h > max) max = h;
            });
        });
        return max;
    }, [data]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Spinner size="md" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="p-4 text-center text-slate-500">
                No activity data available
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6 overflow-x-hidden">
            {/* Timeline Chart */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-300">📈 Activity Timeline</h3>
                    <div className="flex items-center gap-2">
                        {/* Granularity selector */}
                        <div className="flex gap-1">
                            {(['daily', 'weekly', 'monthly', 'quarterly'] as Granularity[]).map(g => (
                                <button
                                    key={g}
                                    onClick={() => setGranularity(g)}
                                    className={cn(
                                        'px-2 py-1 text-xs rounded transition-colors capitalize',
                                        granularity === g
                                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/50'
                                            : 'bg-slate-700/50 text-slate-400 hover:text-slate-300'
                                    )}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Metric type selector */}
                <div className="flex items-center gap-4 mb-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                            type="radio"
                            checked={metricType === 'commits'}
                            onChange={() => setMetricType('commits')}
                            className="text-sky-500"
                        />
                        <span className={metricType === 'commits' ? 'text-slate-200' : 'text-slate-500'}>Commits</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                            type="radio"
                            checked={metricType === 'lines'}
                            onChange={() => setMetricType('lines')}
                            className="text-sky-500"
                        />
                        <span className={metricType === 'lines' ? 'text-slate-200' : 'text-slate-500'}>Lines Changed</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                            type="radio"
                            checked={metricType === 'authors'}
                            onChange={() => setMetricType('authors')}
                            className="text-sky-500"
                        />
                        <span className={metricType === 'authors' ? 'text-slate-200' : 'text-slate-500'}>Active Authors</span>
                    </label>
                </div>

                {/* Chart area */}
                <div className="h-48 flex items-end gap-1">
                    {metricType === 'commits' && data.commits_by_period.map((item, i) => (
                        <div
                            key={i}
                            className="flex-1 min-w-[4px] max-w-[24px] bg-sky-500/80 hover:bg-sky-400 rounded-t transition-colors group relative"
                            style={{ height: `${(item.count / maxCommitCount) * 100}%` }}
                            title={`${item.period}: ${item.count} commits`}
                        >
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-900 text-xs text-slate-300 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                {item.period}: {item.count}
                            </div>
                        </div>
                    ))}
                    {metricType === 'lines' && data.lines_by_period.map((item, i) => (
                        <div
                            key={i}
                            className="flex-1 min-w-[4px] max-w-[24px] flex flex-col gap-px group relative"
                            style={{ height: `${((item.added + item.deleted) / maxLinesChanged) * 100}%` }}
                            title={`${item.period}: +${item.added} / -${item.deleted}`}
                        >
                            <div
                                className="bg-emerald-500/80 hover:bg-emerald-400 rounded-t transition-colors"
                                style={{ height: `${(item.added / (item.added + item.deleted || 1)) * 100}%` }}
                            />
                            <div
                                className="bg-red-500/80 hover:bg-red-400 rounded-b transition-colors"
                                style={{ height: `${(item.deleted / (item.added + item.deleted || 1)) * 100}%` }}
                            />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-900 text-xs text-slate-300 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                {item.period}: <span className="text-emerald-400">+{item.added}</span> / <span className="text-red-400">-{item.deleted}</span>
                            </div>
                        </div>
                    ))}
                    {metricType === 'authors' && data.authors_by_period.map((item, i) => {
                        const maxAuthors = Math.max(1, ...data.authors_by_period.map(d => d.count));
                        return (
                            <div
                                key={i}
                                className="flex-1 min-w-[4px] max-w-[24px] bg-purple-500/80 hover:bg-purple-400 rounded-t transition-colors group relative"
                                style={{ height: `${(item.count / maxAuthors) * 100}%` }}
                                title={`${item.period}: ${item.count} authors`}
                            >
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-900 text-xs text-slate-300 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                    {item.period}: {item.count} authors
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* X-axis labels (show first and last) */}
                {data.commits_by_period.length > 0 && (
                    <div className="flex justify-between mt-2 text-[10px] text-slate-600">
                        <span>{data.commits_by_period[0]?.period}</span>
                        <span>{data.commits_by_period[data.commits_by_period.length - 1]?.period}</span>
                    </div>
                )}
            </div>

            {/* Heatmap Calendar */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-300">📅 Contribution Heatmap</h3>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setSelectedYear('all')}
                            className={cn(
                                'px-2 py-1 text-xs rounded transition-colors',
                                selectedYear === 'all'
                                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/50'
                                    : 'bg-slate-700/50 text-slate-400 hover:text-slate-300'
                            )}
                        >
                            All Time
                        </button>
                        {availableYears.slice(0, 3).map(year => (
                            <button
                                key={year}
                                onClick={() => setSelectedYear(year)}
                                className={cn(
                                    'px-2 py-1 text-xs rounded transition-colors',
                                    selectedYear === year
                                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/50'
                                        : 'bg-slate-700/50 text-slate-400 hover:text-slate-300'
                                )}
                            >
                                {year}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Heatmap grid */}
                <div className="flex flex-wrap gap-0.5">
                    {filteredHeatmapData.map((item, i) => {
                        const intensity = item.count / maxHeatmapValue;
                        let bgClass = 'bg-slate-800';
                        if (item.count > 0) {
                            if (intensity > 0.75) bgClass = 'bg-emerald-500';
                            else if (intensity > 0.5) bgClass = 'bg-emerald-600';
                            else if (intensity > 0.25) bgClass = 'bg-emerald-700';
                            else bgClass = 'bg-emerald-800';
                        }
                        return (
                            <div
                                key={i}
                                className={cn('w-2.5 h-2.5 rounded-sm', bgClass)}
                                title={`${item.date}: ${item.count} commits`}
                            />
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-2 mt-3 text-[10px] text-slate-500">
                    <span>Less</span>
                    <div className="flex gap-0.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-slate-800" />
                        <div className="w-2.5 h-2.5 rounded-sm bg-emerald-800" />
                        <div className="w-2.5 h-2.5 rounded-sm bg-emerald-700" />
                        <div className="w-2.5 h-2.5 rounded-sm bg-emerald-600" />
                        <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    </div>
                    <span>More</span>
                </div>
            </div>

            {/* Lines Changed Stacked Area Chart */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50 overflow-hidden">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">📊 Lines Changed Over Time</h3>

                <div className="h-40 flex items-end gap-1">
                    {data.lines_by_period.map((item, i) => {
                        const total = item.added + item.deleted;
                        const heightPercent = (total / maxLinesChanged) * 100;
                        const addedPercent = total > 0 ? (item.added / total) * 100 : 50;

                        return (
                            <div
                                key={i}
                                className="flex-1 min-w-[4px] max-w-[24px] flex flex-col group relative"
                                style={{ height: `${heightPercent}%` }}
                                title={`${item.period}: +${item.added} / -${item.deleted}`}
                            >
                                <div
                                    className="bg-emerald-500/80 hover:bg-emerald-400 transition-colors rounded-t"
                                    style={{ height: `${addedPercent}%` }}
                                />
                                <div
                                    className="bg-red-500/80 hover:bg-red-400 transition-colors rounded-b"
                                    style={{ height: `${100 - addedPercent}%` }}
                                />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-900 text-xs text-slate-300 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                    {item.period}: <span className="text-emerald-400">+{item.added}</span> / <span className="text-red-400">-{item.deleted}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-3 text-xs">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-emerald-500" />
                        <span className="text-slate-400">Additions</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-red-500" />
                        <span className="text-slate-400">Deletions</span>
                    </div>
                </div>

                {/* X-axis labels */}
                {data.lines_by_period.length > 0 && (
                    <div className="flex justify-between mt-2 text-[10px] text-slate-600">
                        <span>{data.lines_by_period[0]?.period}</span>
                        <span>{data.lines_by_period[data.lines_by_period.length - 1]?.period}</span>
                    </div>
                )}
            </div>

            {/* Velocity Chart */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">⚡ Change Velocity</h3>

                {(() => {
                    // Calculate velocity (commits per period) with moving average
                    const velocityData = data.commits_by_period.map((item, i, arr) => {
                        // Simple moving average (3 periods)
                        const windowSize = 3;
                        const start = Math.max(0, i - windowSize + 1);
                        const window = arr.slice(start, i + 1);
                        const avg = window.reduce((sum, w) => sum + w.count, 0) / window.length;
                        return { ...item, avg };
                    });

                    const maxVelocity = Math.max(1, ...velocityData.map(d => d.count));
                    const avgVelocity = velocityData.length > 0
                        ? velocityData.reduce((sum, d) => sum + d.count, 0) / velocityData.length
                        : 0;

                    // Find peaks (periods with notably high activity)
                    const threshold = avgVelocity * 1.5;
                    const peaks = velocityData.filter(d => d.count > threshold);

                    return (
                        <>
                            <div className="h-32 relative flex items-end gap-1">
                                {/* Average line */}
                                <div
                                    className="absolute left-0 right-0 border-t border-dashed border-amber-500/50 pointer-events-none"
                                    style={{ bottom: `${(avgVelocity / maxVelocity) * 100}%` }}
                                >
                                    <span className="absolute right-0 -top-3 text-[10px] text-amber-400">avg: {avgVelocity.toFixed(1)}</span>
                                </div>

                                {velocityData.map((item, i) => {
                                    const isPeak = item.count > threshold;
                                    const heightPercent = (item.count / maxVelocity) * 100;

                                    return (
                                        <div
                                            key={i}
                                            className={cn(
                                                'flex-1 min-w-[4px] max-w-[24px] rounded-t transition-colors group relative',
                                                isPeak
                                                    ? 'bg-amber-500/80 hover:bg-amber-400'
                                                    : 'bg-sky-500/60 hover:bg-sky-400'
                                            )}
                                            style={{ height: `${heightPercent}%` }}
                                        >
                                            {isPeak && (
                                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-amber-400" />
                                            )}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-900 text-xs text-slate-300 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                {item.period}: {item.count} commits
                                                {isPeak && <span className="text-amber-400 ml-1">⚡ peak</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Stats summary */}
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/50 text-xs">
                                <div className="text-slate-500">
                                    <span className="text-slate-300 font-medium">{peaks.length}</span> peak periods detected
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded bg-sky-500" />
                                        <span className="text-slate-400">Normal</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded bg-amber-500" />
                                        <span className="text-slate-400">Peak (&gt;1.5× avg)</span>
                                    </div>
                                </div>
                            </div>

                            {/* X-axis labels */}
                            {velocityData.length > 0 && (
                                <div className="flex justify-between mt-2 text-[10px] text-slate-600">
                                    <span>{velocityData[0]?.period}</span>
                                    <span>{velocityData[velocityData.length - 1]?.period}</span>
                                </div>
                            )}
                        </>
                    );
                })()}
            </div>

            {/* Day/Hour Matrix */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">⏰ Activity by Day & Hour</h3>

                <div className="space-y-1">
                    {/* Hour labels */}
                    <div className="flex gap-1 ml-10">
                        {[0, 6, 12, 18, 23].map(h => (
                            <div
                                key={h}
                                className="text-[10px] text-slate-600"
                                style={{
                                    position: 'absolute',
                                    left: `${(h / 23) * 100}%`,
                                    transform: 'translateX(-50%)'
                                }}
                            >
                                {h}:00
                            </div>
                        ))}
                    </div>

                    {/* Matrix rows */}
                    {data.day_hour_matrix.map((row, dayIndex) => (
                        <div key={dayIndex} className="flex items-center gap-1">
                            <span className="w-8 text-[10px] text-slate-500">{DAYS[dayIndex]}</span>
                            <div className="flex gap-0.5 flex-1">
                                {row.hours.map((count, hourIndex) => {
                                    const intensity = count / maxDayHourValue;
                                    let bgClass = 'bg-slate-800/50';
                                    if (count > 0) {
                                        if (intensity > 0.75) bgClass = 'bg-sky-500';
                                        else if (intensity > 0.5) bgClass = 'bg-sky-600';
                                        else if (intensity > 0.25) bgClass = 'bg-sky-700';
                                        else bgClass = 'bg-sky-800';
                                    }
                                    return (
                                        <div
                                            key={hourIndex}
                                            className={cn('flex-1 h-4 rounded-sm', bgClass)}
                                            title={`${DAYS[dayIndex]} ${hourIndex}:00 - ${count} commits`}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default FileActivityTab;
