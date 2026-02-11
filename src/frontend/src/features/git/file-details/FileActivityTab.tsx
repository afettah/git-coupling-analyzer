/**
 * FileActivityTab Component
 * 
 * Activity charts for file: timeline (D3 with zoom/pan), heatmap calendar, and day/hour matrix.
 * Uses shared chart components from @/shared/charts.
 */

import { useState, useEffect, useMemo } from 'react';
import { getFileActivity, type FileActivityResponse } from '../../../api/git';
import { Spinner } from '@/shared';
import { TimelineChart, HeatmapCalendar, DayHourMatrix } from '@/shared/charts';
import type { TimeSeriesPoint } from '@/shared/charts';
import { cn } from '@/lib/utils';

interface FileActivityTabProps {
    repoId: string;
    filePath: string;
}

type Granularity = 'daily' | 'weekly' | 'monthly' | 'quarterly';
type MetricType = 'commits' | 'lines' | 'authors';

export function FileActivityTab({ repoId, filePath }: FileActivityTabProps) {
    const [data, setData] = useState<FileActivityResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [granularity, setGranularity] = useState<Granularity>('monthly');
    const [metricType, setMetricType] = useState<MetricType>('commits');
    const [timelineRange, setTimelineRange] = useState<[Date, Date] | undefined>(undefined);
    const [linesRange, setLinesRange] = useState<[Date, Date] | undefined>(undefined);
    const [velocityRange, setVelocityRange] = useState<[Date, Date] | undefined>(undefined);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const result = await getFileActivity(repoId, filePath, { granularity });
                setData(result);
            } catch (e) {
                console.error('Failed to load activity data:', e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [repoId, filePath, granularity]);

    useEffect(() => {
        setTimelineRange(undefined);
        setLinesRange(undefined);
        setVelocityRange(undefined);
    }, [repoId, filePath, granularity, metricType]);

    // Transform data for TimelineChart based on selected metric
    const timelineData: TimeSeriesPoint[] = useMemo(() => {
        if (!data) return [];
        switch (metricType) {
            case 'commits':
                return data.commits_by_period.map(d => ({ date: d.period, value: d.count }));
            case 'lines':
                return data.lines_by_period.map(d => ({ date: d.period, value: d.added + d.deleted }));
            case 'authors':
                return data.authors_by_period.map(d => ({ date: d.period, value: d.count }));
        }
    }, [data, metricType]);

    // Transform heatmap data for HeatmapCalendar
    const heatmapData = useMemo(() => {
        if (!data?.heatmap_data) return [];
        return data.heatmap_data.map(d => ({ date: d.date, value: d.count }));
    }, [data]);

    // Transform day/hour matrix for DayHourMatrix
    const dayHourData = useMemo(() => {
        if (!data?.day_hour_matrix) return [];
        return data.day_hour_matrix.map((cell) => ({
            day: cell.day,
            hour: cell.hour,
            value: cell.count,
        }));
    }, [data]);

    // Lines changed data as separate additions/deletions timeline
    const linesAddedData: TimeSeriesPoint[] = useMemo(() => {
        if (!data?.lines_by_period) return [];
        return data.lines_by_period.map(d => ({ date: d.period, value: d.added }));
    }, [data]);

    const linesDeletedData: TimeSeriesPoint[] = useMemo(() => {
        if (!data?.lines_by_period) return [];
        return data.lines_by_period.map(d => ({ date: d.period, value: d.deleted }));
    }, [data]);

    // Velocity data with peak detection
    const velocityStats = useMemo(() => {
        if (!data?.commits_by_period) return { avg: 0, peaks: 0 };
        const counts = data.commits_by_period.map(d => d.count);
        const avg = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
        const threshold = avg * 1.5;
        const peaks = counts.filter(c => c > threshold).length;
        return { avg, peaks };
    }, [data]);

    const metricLabels: Record<MetricType, string> = {
        commits: 'Commits',
        lines: 'Lines Changed',
        authors: 'Active Authors',
    };

    const metricColors: Record<MetricType, string[]> = {
        commits: ['#0ea5e9'],
        lines: ['#10b981'],
        authors: ['#8b5cf6'],
    };

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
            {/* Timeline Chart with zoom/pan */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-300">📈 Activity Timeline</h3>
                    <div className="flex gap-1">
                        {(['daily', 'weekly', 'monthly', 'quarterly'] as Granularity[]).map(g => (
                            <button data-testid="file-activity-btn-btn-1"
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

                {/* Metric type selector */}
                <div className="flex items-center gap-4 mb-4 text-xs">
                    {(['commits', 'lines', 'authors'] as MetricType[]).map(m => (
                        <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                            <input data-testid="file-activity-input-input-1"
                                type="radio"
                                checked={metricType === m}
                                onChange={() => setMetricType(m)}
                                className="text-sky-500"
                            />
                            <span className={metricType === m ? 'text-slate-200' : 'text-slate-500'}>
                                {metricLabels[m]}
                            </span>
                        </label>
                    ))}
                </div>

                <TimelineChart
                    data={timelineData}
                    chartType="bar"
                    xDomain={timelineRange}
                    yLabel={metricLabels[metricType]}
                    height={200}
                    brushEnabled={true}
                    zoomEnabled={true}
                    onRangeChange={setTimelineRange}
                    colorScheme={metricColors[metricType]}
                />
            </div>

            {/* Contribution Heatmap Calendar */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50 overflow-hidden">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">📅 Contribution Heatmap</h3>
                <HeatmapCalendar
                    data={heatmapData}
                    colorScheme={['#0f172a', '#064e3b', '#047857', '#059669', '#10b981']}
                />
            </div>

            {/* Lines Changed Over Time */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50 overflow-hidden">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">📊 Lines Changed Over Time</h3>

                <TimelineChart
                    data={linesAddedData}
                    chartType="area"
                    xDomain={linesRange}
                    yLabel="Lines"
                    height={180}
                    brushEnabled={true}
                    zoomEnabled={true}
                    onRangeChange={setLinesRange}
                    colorScheme={['#10b981']}
                />

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
            </div>

            {/* Velocity Chart */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">⚡ Change Velocity</h3>

                <TimelineChart
                    data={timelineData}
                    chartType="area"
                    xDomain={velocityRange}
                    yLabel="Commits"
                    height={150}
                    brushEnabled={true}
                    zoomEnabled={true}
                    onRangeChange={setVelocityRange}
                    colorScheme={['#f59e0b']}
                />

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/50 text-xs">
                    <div className="text-slate-500">
                        <span className="text-slate-300 font-medium">{velocityStats.peaks}</span> peak periods detected
                    </div>
                    <div className="text-slate-500">
                        Avg: <span className="text-amber-400">{velocityStats.avg.toFixed(1)}</span> commits/period
                    </div>
                </div>
            </div>

            {/* Day/Hour Matrix */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">⏰ Activity by Day & Hour</h3>
                <DayHourMatrix
                    data={dayHourData}
                    colorScheme={['#0f172a', '#0c4a6e', '#0369a1', '#0284c7', '#0ea5e9']}
                />
            </div>
        </div>
    );
}

export default FileActivityTab;
