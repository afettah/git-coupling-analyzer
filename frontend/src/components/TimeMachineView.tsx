/**
 * Time Machine View
 * 
 * Analyze coupling patterns over time. See how dependencies evolved,
 * identify when hotspots emerged, and track code health trends.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import {
    Clock, Play, Pause, SkipBack, SkipForward, Calendar,
    TrendingUp, TrendingDown, AlertTriangle, GitCommit,
    Link2, Rewind, FastForward
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimePoint {
    date: string;
    totalFiles: number;
    totalCoupling: number;
    avgCoupling: number;
    hotspots: number;
    commits: number;
    riskScore: number;
    topFiles: Array<{ path: string; coupling: number; trend: 'up' | 'down' | 'stable' }>;
}

interface TimeMachineViewProps {
    repoId: string;
}

// Generate mock time series data
function generateMockTimeline(): TimePoint[] {
    const points: TimePoint[] = [];
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 24); // 2 years ago

    const fileNames = [
        'src/core/engine.ts', 'src/api/handlers.ts', 'src/utils/helpers.ts',
        'src/db/queries.ts', 'src/auth/middleware.ts', 'src/config/settings.ts',
    ];

    for (let i = 0; i < 24; i++) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + i);

        const baseFiles = 500 + i * 15 + Math.floor(Math.random() * 20);
        const baseCoupling = 0.25 + (i / 24) * 0.15 + (Math.random() * 0.1 - 0.05);

        points.push({
            date: date.toISOString(),
            totalFiles: baseFiles,
            totalCoupling: baseFiles * baseCoupling,
            avgCoupling: Math.max(0, Math.min(1, baseCoupling)),
            hotspots: Math.floor(5 + i * 0.3 + Math.random() * 3),
            commits: 100 + Math.floor(Math.random() * 150),
            riskScore: Math.floor(30 + (i / 24) * 20 + Math.random() * 15),
            topFiles: fileNames.slice(0, 3 + Math.floor(Math.random() * 3)).map(path => ({
                path,
                coupling: 0.4 + Math.random() * 0.5,
                trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as any,
            })),
        });
    }

    return points;
}

export function TimeMachineView({ repoId }: TimeMachineViewProps) {
    const [timeline, setTimeline] = useState<TimePoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playSpeed, setPlaySpeed] = useState(1000);
    const chartRef = useRef<HTMLDivElement>(null);
    const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await new Promise(r => setTimeout(r, 400));
            const data = generateMockTimeline();
            setTimeline(data);
            setCurrentIndex(data.length - 1); // Start at latest
            setLoading(false);
        };
        loadData();
    }, [repoId]);

    // Auto-play functionality
    useEffect(() => {
        if (isPlaying) {
            playIntervalRef.current = setInterval(() => {
                setCurrentIndex(prev => {
                    if (prev >= timeline.length - 1) {
                        setIsPlaying(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, playSpeed);
        }

        return () => {
            if (playIntervalRef.current) {
                clearInterval(playIntervalRef.current);
            }
        };
    }, [isPlaying, timeline.length, playSpeed]);

    const currentPoint = useMemo(() => timeline[currentIndex], [timeline, currentIndex]);

    // Trend calculations
    const trends = useMemo(() => {
        if (currentIndex === 0 || timeline.length < 2) return null;
        const prev = timeline[currentIndex - 1];
        const curr = currentPoint;
        if (!prev || !curr) return null;

        return {
            couplingTrend: curr.avgCoupling - prev.avgCoupling,
            hotspotsTrend: curr.hotspots - prev.hotspots,
            riskTrend: curr.riskScore - prev.riskScore,
            filesTrend: curr.totalFiles - prev.totalFiles,
        };
    }, [timeline, currentIndex, currentPoint]);

    // Render chart
    useEffect(() => {
        if (!chartRef.current || timeline.length === 0) return;

        const container = chartRef.current;
        const width = container.clientWidth;
        const height = 200;
        const margin = { top: 20, right: 30, bottom: 30, left: 50 };

        d3.select(container).selectAll('*').remove();

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        // Scales
        const xScale = d3.scaleTime()
            .domain([new Date(timeline[0].date), new Date(timeline[timeline.length - 1].date)])
            .range([0, innerWidth]);

        const yScale = d3.scaleLinear()
            .domain([0, Math.max(...timeline.map(d => d.avgCoupling)) * 1.2])
            .range([innerHeight, 0]);

        const riskScale = d3.scaleLinear()
            .domain([0, 100])
            .range([innerHeight, 0]);

        // Axes
        g.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.timeFormat('%b %y') as any))
            .attr('color', '#475569');

        g.append('g')
            .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => `${Math.round(+d * 100)}%`))
            .attr('color', '#475569');

        // Coupling line
        const couplingLine = d3.line<TimePoint>()
            .x(d => xScale(new Date(d.date)))
            .y(d => yScale(d.avgCoupling))
            .curve(d3.curveMonotoneX);

        g.append('path')
            .datum(timeline)
            .attr('fill', 'none')
            .attr('stroke', '#a78bfa')
            .attr('stroke-width', 2)
            .attr('d', couplingLine);

        // Risk line
        const riskLine = d3.line<TimePoint>()
            .x(d => xScale(new Date(d.date)))
            .y(d => riskScale(d.riskScore))
            .curve(d3.curveMonotoneX);

        g.append('path')
            .datum(timeline)
            .attr('fill', 'none')
            .attr('stroke', '#f87171')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '4,4')
            .attr('d', riskLine);

        // Current position indicator
        if (currentPoint) {
            g.append('line')
                .attr('x1', xScale(new Date(currentPoint.date)))
                .attr('x2', xScale(new Date(currentPoint.date)))
                .attr('y1', 0)
                .attr('y2', innerHeight)
                .attr('stroke', '#38bdf8')
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '4,4');

            g.append('circle')
                .attr('cx', xScale(new Date(currentPoint.date)))
                .attr('cy', yScale(currentPoint.avgCoupling))
                .attr('r', 6)
                .attr('fill', '#a78bfa');

            g.append('circle')
                .attr('cx', xScale(new Date(currentPoint.date)))
                .attr('cy', riskScale(currentPoint.riskScore))
                .attr('r', 6)
                .attr('fill', '#f87171');
        }

    }, [timeline, currentIndex, currentPoint]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
                    <p className="text-slate-500">Loading timeline...</p>
                </div>
            </div>
        );
    }

    if (!currentPoint) return null;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400">
                        <Clock size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-100">Time Machine</h1>
                        <p className="text-sm text-slate-500">
                            Analyze how coupling patterns evolved over time
                        </p>
                    </div>
                </div>
            </div>

            {/* Timeline Chart */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-200">Coupling & Risk Trends</h3>
                    <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                            Coupling
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-0.5 bg-red-400" style={{ borderTop: '2px dashed' }}></span>
                            Risk
                        </span>
                    </div>
                </div>
                <div ref={chartRef} className="w-full h-52" />
            </div>

            {/* Playback Controls */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between gap-6">
                    {/* Date Display */}
                    <div className="flex items-center gap-3">
                        <Calendar size={18} className="text-sky-400" />
                        <div>
                            <div className="text-lg font-bold text-slate-100">
                                {new Date(currentPoint.date).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                })}
                            </div>
                            <div className="text-xs text-slate-500">
                                Point {currentIndex + 1} of {timeline.length}
                            </div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentIndex(0)}
                            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Go to start"
                        >
                            <Rewind size={18} />
                        </button>
                        <button
                            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                            disabled={currentIndex === 0}
                        >
                            <SkipBack size={18} />
                        </button>
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className={cn(
                                'p-3 rounded-full transition-colors',
                                isPlaying
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-sky-500/20 text-sky-400 hover:bg-sky-500/30'
                            )}
                        >
                            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                        </button>
                        <button
                            onClick={() => setCurrentIndex(Math.min(timeline.length - 1, currentIndex + 1))}
                            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                            disabled={currentIndex === timeline.length - 1}
                        >
                            <SkipForward size={18} />
                        </button>
                        <button
                            onClick={() => setCurrentIndex(timeline.length - 1)}
                            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Go to end"
                        >
                            <FastForward size={18} />
                        </button>
                    </div>

                    {/* Speed Control */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Speed:</span>
                        {[2000, 1000, 500].map(speed => (
                            <button
                                key={speed}
                                onClick={() => setPlaySpeed(speed)}
                                className={cn(
                                    'px-2 py-1 text-xs rounded transition-colors',
                                    playSpeed === speed
                                        ? 'bg-sky-500/20 text-sky-400'
                                        : 'text-slate-500 hover:text-slate-300'
                                )}
                            >
                                {speed === 2000 ? '0.5x' : speed === 1000 ? '1x' : '2x'}
                            </button>
                        ))}
                    </div>

                    {/* Slider */}
                    <div className="flex-1 max-w-md">
                        <input
                            type="range"
                            min={0}
                            max={timeline.length - 1}
                            value={currentIndex}
                            onChange={(e) => setCurrentIndex(parseInt(e.target.value))}
                            className="w-full accent-sky-500"
                        />
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <TrendCard
                    label="Avg Coupling"
                    value={`${Math.round(currentPoint.avgCoupling * 100)}%`}
                    trend={trends?.couplingTrend}
                    icon={<Link2 size={18} />}
                    color="purple"
                />
                <TrendCard
                    label="Hotspots"
                    value={currentPoint.hotspots.toString()}
                    trend={trends?.hotspotsTrend}
                    icon={<AlertTriangle size={18} />}
                    color="amber"
                />
                <TrendCard
                    label="Risk Score"
                    value={currentPoint.riskScore.toString()}
                    trend={trends?.riskTrend}
                    icon={<TrendingUp size={18} />}
                    color="red"
                    invertTrend
                />
                <TrendCard
                    label="Total Files"
                    value={currentPoint.totalFiles.toString()}
                    trend={trends?.filesTrend}
                    icon={<GitCommit size={18} />}
                    color="sky"
                />
            </div>

            {/* Top Coupled Files at This Point */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="font-semibold text-slate-200 mb-4">
                    Top Coupled Files at This Point
                </h3>
                <div className="space-y-2">
                    {currentPoint.topFiles.map((file, i) => (
                        <div
                            key={file.path}
                            className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                        >
                            <div className="flex items-center gap-3">
                                <span className="w-6 h-6 flex items-center justify-center text-xs font-bold text-slate-500 bg-slate-700 rounded">
                                    {i + 1}
                                </span>
                                <span className="text-sm text-slate-300 font-mono">{file.path}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-purple-400 font-semibold">
                                    {Math.round(file.coupling * 100)}%
                                </span>
                                {file.trend === 'up' && <TrendingUp size={14} className="text-red-400" />}
                                {file.trend === 'down' && <TrendingDown size={14} className="text-emerald-400" />}
                                {file.trend === 'stable' && <span className="text-slate-500">—</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Insights */}
            <div className="bg-gradient-to-br from-purple-500/10 to-slate-900 border border-purple-500/20 rounded-2xl p-5">
                <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
                    <Clock size={18} className="text-purple-400" />
                    Timeline Insights
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="p-3 bg-slate-900/50 rounded-lg">
                        <div className="text-slate-500 text-xs mb-1">Coupling Growth Rate</div>
                        <div className="text-purple-400 font-semibold">
                            +{((currentPoint.avgCoupling / timeline[0].avgCoupling - 1) * 100).toFixed(1)}% over period
                        </div>
                    </div>
                    <div className="p-3 bg-slate-900/50 rounded-lg">
                        <div className="text-slate-500 text-xs mb-1">Hotspot Emergence</div>
                        <div className="text-amber-400 font-semibold">
                            {currentPoint.hotspots - timeline[0].hotspots} new hotspots identified
                        </div>
                    </div>
                    <div className="p-3 bg-slate-900/50 rounded-lg">
                        <div className="text-slate-500 text-xs mb-1">Codebase Growth</div>
                        <div className="text-sky-400 font-semibold">
                            {currentPoint.totalFiles - timeline[0].totalFiles} files added
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Trend Card Component
function TrendCard({
    label,
    value,
    trend,
    icon,
    color,
    invertTrend = false,
}: {
    label: string;
    value: string;
    trend?: number | null;
    icon: React.ReactNode;
    color: 'purple' | 'amber' | 'red' | 'sky';
    invertTrend?: boolean;
}) {
    const colorClasses = {
        purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        red: 'text-red-400 bg-red-500/10 border-red-500/20',
        sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    }[color];

    const trendIsPositive = trend !== null && trend !== undefined && (invertTrend ? trend < 0 : trend > 0);
    const trendIsNegative = trend !== null && trend !== undefined && (invertTrend ? trend > 0 : trend < 0);

    return (
        <div className={cn('p-4 rounded-xl border', colorClasses)}>
            <div className="flex items-center justify-between mb-2">
                <span className={cn('opacity-70', colorClasses.split(' ')[0])}>{icon}</span>
                {trend !== null && trend !== undefined && trend !== 0 && (
                    <span className={cn('flex items-center gap-0.5 text-xs font-medium',
                        trendIsNegative ? 'text-emerald-400' : trendIsPositive ? 'text-red-400' : 'text-slate-500'
                    )}>
                        {trend > 0 ? '+' : ''}{typeof trend === 'number' && trend < 1 && trend > -1 
                            ? `${(trend * 100).toFixed(1)}%` 
                            : trend.toFixed(0)}
                        {trendIsPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    </span>
                )}
            </div>
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</div>
            <div className={cn('text-2xl font-bold', colorClasses.split(' ')[0])}>{value}</div>
        </div>
    );
}

export default TimeMachineView;
