/**
 * FileAuthorsTab Component
 * 
 * Author statistics and contribution charts.
 */

import { useState, useEffect, useMemo } from 'react';
import { getFileAuthors, type FileAuthorsResponse, type FileAuthor } from '../../../api/git';
import { Spinner } from '@/shared';
import { TimelineChart } from '@/shared/charts';
import { cn } from '@/lib/utils';
import { Crown, ArrowUpDown } from 'lucide-react';

interface FileAuthorsTabProps {
    repoId: string;
    filePath: string;
}

type SortField = 'commits' | 'lines_added' | 'lines_deleted' | 'last_commit';
type SortDir = 'asc' | 'desc';

// Simple donut chart component
function DonutChart({ authors }: { authors: FileAuthor[] }) {
    const total = authors.reduce((sum, a) => sum + a.commits, 0);
    const topAuthors = authors.slice(0, 6);
    const otherCount = authors.slice(6).reduce((sum, a) => sum + a.commits, 0);

    const colors = [
        '#38bdf8', // sky-400
        '#a78bfa', // purple-400
        '#34d399', // emerald-400
        '#fbbf24', // amber-400
        '#f472b6', // pink-400
        '#60a5fa', // blue-400
        '#94a3b8', // slate-400 (for "others")
    ];

    // Calculate stroke-dasharray and stroke-dashoffset for each segment
    const segments: Array<{ color: string; offset: number; length: number; author: string; commits: number }> = [];
    let currentOffset = 0;
    const circumference = 2 * Math.PI * 40; // radius = 40

    topAuthors.forEach((author, i) => {
        const percentage = author.commits / total;
        const length = percentage * circumference;
        segments.push({
            color: colors[i],
            offset: currentOffset,
            length,
            author: author.name,
            commits: author.commits,
        });
        currentOffset += length;
    });

    if (otherCount > 0) {
        segments.push({
            color: colors[6],
            offset: currentOffset,
            length: (otherCount / total) * circumference,
            author: 'Others',
            commits: otherCount,
        });
    }

    return (
        <div className="flex items-center gap-6">
            <div className="relative">
                <svg width="120" height="120" viewBox="0 0 100 100">
                    {segments.map((seg, i) => (
                        <circle
                            key={i}
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke={seg.color}
                            strokeWidth="16"
                            strokeDasharray={`${seg.length} ${circumference}`}
                            strokeDashoffset={-seg.offset}
                            transform="rotate(-90 50 50)"
                            className="transition-all duration-300"
                        >
                            <title>{seg.author}: {seg.commits} commits ({Math.round(seg.commits / total * 100)}%)</title>
                        </circle>
                    ))}
                    <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" className="fill-slate-300 text-lg font-bold">
                        {authors.length}
                    </text>
                    <text x="50" y="62" textAnchor="middle" dominantBaseline="middle" className="fill-slate-500 text-[8px]">
                        authors
                    </text>
                </svg>
            </div>

            <div className="space-y-1.5">
                {segments.map((seg, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                        <span className="text-slate-400 truncate max-w-[120px]">{seg.author}</span>
                        <span className="text-slate-500">{Math.round(seg.commits / total * 100)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Format relative time
function formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
}

export function FileAuthorsTab({ repoId, filePath }: FileAuthorsTabProps) {
    const [data, setData] = useState<FileAuthorsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [sortField, setSortField] = useState<SortField>('commits');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const result = await getFileAuthors(repoId, filePath);
                setData(result);
            } catch (e) {
                console.error('Failed to load authors data:', e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [repoId, filePath]);

    const sortedAuthors = useMemo(() => {
        if (!data?.authors) return [];
        const sorted = [...data.authors].sort((a, b) => {
            let aVal: number | string = 0;
            let bVal: number | string = 0;

            switch (sortField) {
                case 'commits':
                    aVal = a.commits;
                    bVal = b.commits;
                    break;
                case 'lines_added':
                    aVal = a.lines_added;
                    bVal = b.lines_added;
                    break;
                case 'lines_deleted':
                    aVal = a.lines_deleted;
                    bVal = b.lines_deleted;
                    break;
                case 'last_commit':
                    aVal = a.last_commit || '';
                    bVal = b.last_commit || '';
                    break;
            }

            if (sortDir === 'asc') {
                return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            }
            return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        });
        return sorted;
    }, [data, sortField, sortDir]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Spinner size="md" />
            </div>
        );
    }

    if (!data || data.authors.length === 0) {
        return (
            <div className="p-4 text-center text-slate-500">
                No author data available
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6">
            {/* Summary */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-300">👥 Authors ({data.authors.length} total)</h3>
                </div>

                <DonutChart authors={data.authors} />

                {/* Bus Factor Indicator */}
                {(() => {
                    const total = data.authors.reduce((sum, a) => sum + a.commits, 0);
                    let cumulative = 0;
                    let busFactor = 0;
                    for (const author of data.authors) {
                        cumulative += author.commits;
                        busFactor++;
                        if (cumulative / total >= 0.5) break;
                    }
                    const level = busFactor === 1 ? 'high' : busFactor <= 2 ? 'medium' : 'low';
                    const config = {
                        high: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'High Risk' },
                        medium: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Moderate' },
                        low: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Healthy' },
                    }[level];

                    return (
                        <div className={cn('mt-4 p-3 rounded-lg border', config.bg, config.border)}>
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-slate-400">Bus Factor</div>
                                <div className={cn('text-sm font-bold', config.color)}>
                                    {busFactor} {busFactor === 1 ? 'person' : 'people'}
                                </div>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                                {busFactor === 1
                                    ? '⚠️ Only 1 person owns 50%+ of commits — knowledge silo risk'
                                    : `${busFactor} people account for 50%+ of commits`
                                }
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Author list */}
            <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-slate-500 text-xs border-b border-slate-700/50">
                            <th className="p-3 font-medium">Author</th>
                            <th
                                className="p-3 font-medium cursor-pointer hover:text-slate-300"
                                onClick={() => handleSort('commits')}
                            >
                                <span className="flex items-center gap-1">
                                    Commits
                                    {sortField === 'commits' && <ArrowUpDown size={12} />}
                                </span>
                            </th>
                            <th
                                className="p-3 font-medium cursor-pointer hover:text-slate-300"
                                onClick={() => handleSort('lines_added')}
                            >
                                <span className="flex items-center gap-1">
                                    +Lines
                                    {sortField === 'lines_added' && <ArrowUpDown size={12} />}
                                </span>
                            </th>
                            <th
                                className="p-3 font-medium cursor-pointer hover:text-slate-300"
                                onClick={() => handleSort('lines_deleted')}
                            >
                                <span className="flex items-center gap-1">
                                    -Lines
                                    {sortField === 'lines_deleted' && <ArrowUpDown size={12} />}
                                </span>
                            </th>
                            <th
                                className="p-3 font-medium cursor-pointer hover:text-slate-300"
                                onClick={() => handleSort('last_commit')}
                            >
                                <span className="flex items-center gap-1">
                                    Last Edit
                                    {sortField === 'last_commit' && <ArrowUpDown size={12} />}
                                </span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedAuthors.map((author, i) => (
                            <tr
                                key={author.name}
                                className={cn(
                                    'border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors',
                                    i === 0 && sortField === 'commits' && sortDir === 'desc' && 'bg-amber-500/5'
                                )}
                            >
                                <td className="p-3">
                                    <div className="flex items-center gap-2">
                                        {i === 0 && sortField === 'commits' && sortDir === 'desc' && (
                                            <Crown size={14} className="text-amber-400" />
                                        )}
                                        <span className="text-slate-300">{author.name}</span>
                                    </div>
                                </td>
                                <td className="p-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-300">{author.commits}</span>
                                        <span className="text-slate-600 text-xs">({author.percentage}%)</span>
                                    </div>
                                </td>
                                <td className="p-3 text-emerald-400">+{author.lines_added.toLocaleString()}</td>
                                <td className="p-3 text-red-400">-{author.lines_deleted.toLocaleString()}</td>
                                <td className="p-3 text-slate-500">{formatRelativeTime(author.last_commit)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Author activity timeline using TimelineChart */}
            {(data.ownership_timeline?.length ?? 0) > 0 && (
                <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                    <h3 className="text-sm font-semibold text-slate-300 mb-4">📈 Author Activity Over Time</h3>

                    {data.authors.slice(0, 3).map((author, authorIndex) => {
                        const authorColors = ['#0ea5e9', '#a78bfa', '#34d399'];
                        const timelineData = (data.ownership_timeline ?? []).map((point) => {
                            const value = point.contributions[author.name] ?? 0;
                            return { date: point.date, value };
                        });

                        return (
                            <div key={author.name} className="mb-3">
                                <div className="text-xs text-slate-400 mb-1">{author.name}</div>
                                <TimelineChart
                                    data={timelineData}
                                    chartType="area"
                                    height={80}
                                    zoomEnabled={false}
                                    colorScheme={[authorColors[authorIndex]]}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default FileAuthorsTab;
