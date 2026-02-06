/**
 * Project Dashboard
 * 
 * Comprehensive project statistics dashboard with charts, metrics, and insights.
 * Provides an overview of the project's health, coupling patterns, and activity.
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    TrendingUp, TrendingDown, AlertTriangle, Activity, Users, GitCommit,
    Link2, FileCode, Flame, Shield, ChevronRight,
    BarChart3, PieChart, Calendar, Zap, Target, Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type RepoInfo } from '../api';

// Mock data types
interface ProjectStats {
    totalFiles: number;
    totalCommits: number;
    totalAuthors: number;
    avgCoupling: number;
    hotspotCount: number;
    riskScore: number;
    lastAnalyzed: string;
    codebaseAge: number;
    linesAdded: number;
    linesDeleted: number;
}

interface TrendData {
    period: string;
    commits: number;
    coupling: number;
    files: number;
}

interface HotspotFile {
    path: string;
    commits: number;
    coupling: number;
    authors: number;
    riskScore: number;
}

interface AuthorStats {
    name: string;
    commits: number;
    files: number;
    percentage: number;
}

interface CouplingCluster {
    id: number;
    files: number;
    avgCoupling: number;
    name: string;
}

// Generate mock data for demonstration
function generateMockStats(): ProjectStats {
    return {
        totalFiles: 847,
        totalCommits: 3421,
        totalAuthors: 23,
        avgCoupling: 0.34,
        hotspotCount: 12,
        riskScore: 42,
        lastAnalyzed: new Date().toISOString(),
        codebaseAge: 847,
        linesAdded: 234567,
        linesDeleted: 98234,
    };
}

function generateMockTrends(): TrendData[] {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((period, i) => ({
        period,
        commits: 150 + Math.floor(Math.random() * 200),
        coupling: 0.25 + Math.random() * 0.2,
        files: 700 + i * 20 + Math.floor(Math.random() * 30),
    }));
}

function generateMockHotspots(): HotspotFile[] {
    return [
        { path: 'src/core/engine.ts', commits: 234, coupling: 0.78, authors: 12, riskScore: 89 },
        { path: 'src/api/handlers.ts', commits: 189, coupling: 0.65, authors: 8, riskScore: 76 },
        { path: 'src/utils/helpers.ts', commits: 156, coupling: 0.82, authors: 15, riskScore: 72 },
        { path: 'src/db/queries.ts', commits: 134, coupling: 0.54, authors: 6, riskScore: 65 },
        { path: 'src/auth/middleware.ts', commits: 112, coupling: 0.71, authors: 9, riskScore: 61 },
        { path: 'src/config/settings.ts', commits: 98, coupling: 0.45, authors: 5, riskScore: 55 },
    ];
}

function generateMockAuthors(): AuthorStats[] {
    return [
        { name: 'Alice Chen', commits: 567, files: 234, percentage: 28 },
        { name: 'Bob Smith', commits: 423, files: 189, percentage: 21 },
        { name: 'Carol Davis', commits: 312, files: 145, percentage: 15 },
        { name: 'David Lee', commits: 256, files: 98, percentage: 12 },
        { name: 'Eva Martinez', commits: 198, files: 76, percentage: 10 },
    ];
}

function generateMockClusters(): CouplingCluster[] {
    return [
        { id: 1, files: 34, avgCoupling: 0.72, name: 'Core Engine' },
        { id: 2, files: 28, avgCoupling: 0.65, name: 'API Layer' },
        { id: 3, files: 45, avgCoupling: 0.58, name: 'Data Access' },
        { id: 4, files: 21, avgCoupling: 0.81, name: 'Auth Module' },
        { id: 5, files: 56, avgCoupling: 0.42, name: 'Utils & Helpers' },
    ];
}

interface ProjectDashboardProps {
    repo: RepoInfo;
}

export function ProjectDashboard({ repo }: ProjectDashboardProps) {
    const navigate = useNavigate();
    const [stats, setStats] = useState<ProjectStats | null>(null);
    const [trends, setTrends] = useState<TrendData[]>([]);
    const [hotspots, setHotspots] = useState<HotspotFile[]>([]);
    const [authors, setAuthors] = useState<AuthorStats[]>([]);
    const [clusters, setClusters] = useState<CouplingCluster[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate loading data
        const loadData = async () => {
            setLoading(true);
            await new Promise(r => setTimeout(r, 500));
            setStats(generateMockStats());
            setTrends(generateMockTrends());
            setHotspots(generateMockHotspots());
            setAuthors(generateMockAuthors());
            setClusters(generateMockClusters());
            setLoading(false);
        };
        loadData();
    }, [repo.id]);

    const riskColor = useMemo(() => {
        if (!stats) return 'text-slate-400';
        if (stats.riskScore >= 70) return 'text-red-400';
        if (stats.riskScore >= 40) return 'text-amber-400';
        return 'text-emerald-400';
    }, [stats]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
                    <p className="text-slate-500">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    if (!stats) return null;

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">Project Dashboard</h1>
                    <p className="text-sm text-slate-500">
                        Last analyzed: {new Date(stats.lastAnalyzed).toLocaleString()}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(`/repos/${repo.id}/graph`)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
                    >
                        <Eye size={16} />
                        View Graph
                    </button>
                    <button
                        onClick={() => navigate(`/repos/${repo.id}/clustering`)}
                        className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 rounded-lg text-sm text-slate-900 font-semibold transition-colors"
                    >
                        <Target size={16} />
                        Run Analysis
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <StatCard
                    icon={<FileCode size={20} />}
                    label="Files"
                    value={stats.totalFiles.toLocaleString()}
                    color="text-sky-400"
                    bgColor="bg-sky-500/10"
                />
                <StatCard
                    icon={<GitCommit size={20} />}
                    label="Commits"
                    value={stats.totalCommits.toLocaleString()}
                    color="text-indigo-400"
                    bgColor="bg-indigo-500/10"
                />
                <StatCard
                    icon={<Users size={20} />}
                    label="Authors"
                    value={stats.totalAuthors.toString()}
                    color="text-purple-400"
                    bgColor="bg-purple-500/10"
                />
                <StatCard
                    icon={<Link2 size={20} />}
                    label="Avg Coupling"
                    value={`${Math.round(stats.avgCoupling * 100)}%`}
                    color="text-amber-400"
                    bgColor="bg-amber-500/10"
                />
                <StatCard
                    icon={<Flame size={20} />}
                    label="Hotspots"
                    value={stats.hotspotCount.toString()}
                    color="text-red-400"
                    bgColor="bg-red-500/10"
                />
                <StatCard
                    icon={<Shield size={20} />}
                    label="Health Score"
                    value={`${100 - stats.riskScore}/100`}
                    color={riskColor}
                    bgColor={stats.riskScore >= 70 ? 'bg-red-500/10' : stats.riskScore >= 40 ? 'bg-amber-500/10' : 'bg-emerald-500/10'}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Activity Chart */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Activity size={18} className="text-sky-400" />
                            <h3 className="font-semibold text-slate-200">Activity Trends</h3>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-sky-500"></span>
                                Commits
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                                Coupling
                            </span>
                        </div>
                    </div>
                    <ActivityChart data={trends} />
                </div>

                {/* Coupling Distribution */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <PieChart size={18} className="text-purple-400" />
                        <h3 className="font-semibold text-slate-200">Cluster Distribution</h3>
                    </div>
                    <ClusterChart clusters={clusters} />
                </div>
            </div>

            {/* Second Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Hotspots */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Flame size={18} className="text-red-400" />
                            <h3 className="font-semibold text-slate-200">Hotspot Files</h3>
                        </div>
                        <button
                            onClick={() => navigate(`/repos/${repo.id}/tree`)}
                            className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
                        >
                            View All <ChevronRight size={14} />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {hotspots.map((file, i) => (
                            <HotspotRow key={file.path} file={file} rank={i + 1} onClick={() => navigate(`/repos/${repo.id}/file-details/${encodeURIComponent(file.path)}`)} />
                        ))}
                    </div>
                </div>

                {/* Top Authors */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Users size={18} className="text-purple-400" />
                        <h3 className="font-semibold text-slate-200">Top Contributors</h3>
                    </div>
                    <div className="space-y-3">
                        {authors.map((author, i) => (
                            <AuthorRow key={author.name} author={author} rank={i + 1} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Code Changes Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                    <BarChart3 size={18} className="text-emerald-400" />
                    <h3 className="font-semibold text-slate-200">Code Changes Summary</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                        <div className="flex items-center gap-2 text-emerald-400 mb-2">
                            <TrendingUp size={18} />
                            <span className="text-sm font-medium">Lines Added</span>
                        </div>
                        <div className="text-2xl font-bold text-emerald-400">
                            +{stats.linesAdded.toLocaleString()}
                        </div>
                    </div>
                    <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/20">
                        <div className="flex items-center gap-2 text-red-400 mb-2">
                            <TrendingDown size={18} />
                            <span className="text-sm font-medium">Lines Deleted</span>
                        </div>
                        <div className="text-2xl font-bold text-red-400">
                            -{stats.linesDeleted.toLocaleString()}
                        </div>
                    </div>
                    <div className="p-4 bg-sky-500/5 rounded-xl border border-sky-500/20">
                        <div className="flex items-center gap-2 text-sky-400 mb-2">
                            <Calendar size={18} />
                            <span className="text-sm font-medium">Codebase Age</span>
                        </div>
                        <div className="text-2xl font-bold text-sky-400">
                            {Math.floor(stats.codebaseAge / 365)}y {Math.floor((stats.codebaseAge % 365) / 30)}m
                        </div>
                    </div>
                    <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/20">
                        <div className="flex items-center gap-2 text-amber-400 mb-2">
                            <Zap size={18} />
                            <span className="text-sm font-medium">Avg Commits/Day</span>
                        </div>
                        <div className="text-2xl font-bold text-amber-400">
                            {(stats.totalCommits / stats.codebaseAge).toFixed(1)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Insights */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle size={18} className="text-amber-400" />
                    <h3 className="font-semibold text-slate-200">Key Insights & Recommendations</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <InsightCard
                        type="warning"
                        title="High Coupling Detected"
                        description="6 files have coupling >70%. Consider refactoring to reduce dependencies."
                        action="View Files"
                        onClick={() => navigate(`/repos/${repo.id}/tree`)}
                    />
                    <InsightCard
                        type="info"
                        title="Active Development Zone"
                        description="src/core/ has 45% of all commits. This is your most active area."
                        action="Explore"
                        onClick={() => navigate(`/repos/${repo.id}/folder-details/src/core`)}
                    />
                    <InsightCard
                        type="success"
                        title="Good Modularity"
                        description="5 well-defined clusters detected with clear boundaries."
                        action="View Clusters"
                        onClick={() => navigate(`/repos/${repo.id}/clustering`)}
                    />
                </div>
            </div>
        </div>
    );
}

// Stat Card Component
function StatCard({
    icon,
    label,
    value,
    color,
    bgColor,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    color: string;
    bgColor: string;
}) {
    return (
        <div className={cn('p-4 rounded-xl border border-slate-800', bgColor)}>
            <div className={cn('mb-2', color)}>{icon}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</div>
            <div className={cn('text-xl font-bold', color)}>{value}</div>
        </div>
    );
}

// Activity Chart Component
function ActivityChart({ data }: { data: TrendData[] }) {
    const maxCommits = Math.max(...data.map(d => d.commits));
    
    return (
        <div className="h-48 flex items-end gap-2">
            {data.map((d) => (
                <div key={d.period} className="flex-1 flex flex-col items-center gap-1">
                    <div className="relative w-full flex-1 flex items-end">
                        <div
                            className="w-full bg-sky-500/80 rounded-t-sm transition-all hover:bg-sky-400"
                            style={{ height: `${(d.commits / maxCommits) * 100}%` }}
                            title={`${d.commits} commits`}
                        />
                        <div
                            className="absolute bottom-0 left-0 w-full bg-purple-500/40 rounded-t-sm"
                            style={{ height: `${d.coupling * 100}%` }}
                        />
                    </div>
                    <span className="text-[10px] text-slate-500">{d.period}</span>
                </div>
            ))}
        </div>
    );
}

// Cluster Chart Component
function ClusterChart({ clusters }: { clusters: CouplingCluster[] }) {
    const total = clusters.reduce((acc, c) => acc + c.files, 0);
    
    const colors = ['#38bdf8', '#a78bfa', '#f472b6', '#34d399', '#fbbf24'];
    
    return (
        <div className="space-y-4">
            <div className="h-8 rounded-full overflow-hidden flex">
                {clusters.map((cluster, i) => {
                    const width = (cluster.files / total) * 100;
                    return (
                        <div
                            key={cluster.id}
                            className="h-full transition-all hover:opacity-80"
                            style={{ width: `${width}%`, backgroundColor: colors[i % colors.length] }}
                            title={`${cluster.name}: ${cluster.files} files`}
                        />
                    );
                })}
            </div>
            <div className="grid grid-cols-2 gap-2">
                {clusters.map((cluster, i) => (
                    <div key={cluster.id} className="flex items-center gap-2 text-xs">
                        <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: colors[i % colors.length] }}
                        />
                        <span className="text-slate-400 truncate">{cluster.name}</span>
                        <span className="text-slate-500 ml-auto">{cluster.files}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Hotspot Row Component
function HotspotRow({ file, rank, onClick }: { file: HotspotFile; rank: number; onClick: () => void }) {
    const riskColor = file.riskScore >= 70 ? 'text-red-400' : file.riskScore >= 40 ? 'text-amber-400' : 'text-emerald-400';
    
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors group"
        >
            <span className="w-6 h-6 flex items-center justify-center text-xs font-bold text-slate-500 bg-slate-700 rounded">
                {rank}
            </span>
            <span className="flex-1 text-sm text-slate-300 truncate text-left font-mono">
                {file.path}
            </span>
            <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1 text-sky-400">
                    <GitCommit size={12} />
                    {file.commits}
                </span>
                <span className="flex items-center gap-1 text-purple-400">
                    <Link2 size={12} />
                    {Math.round(file.coupling * 100)}%
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                    <Users size={12} />
                    {file.authors}
                </span>
                <span className={cn('font-semibold', riskColor)}>
                    {file.riskScore}
                </span>
            </div>
            <ChevronRight size={16} className="text-slate-600 group-hover:text-sky-400 transition-colors" />
        </button>
    );
}

// Author Row Component
function AuthorRow({ author, rank }: { author: AuthorStats; rank: number }) {
    return (
        <div className="flex items-center gap-3">
            <span className="w-6 h-6 flex items-center justify-center text-xs font-bold text-slate-500 bg-slate-700 rounded-full">
                {rank}
            </span>
            <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-300 truncate">{author.name}</div>
                <div className="text-xs text-slate-500">
                    {author.commits} commits · {author.files} files
                </div>
            </div>
            <div className="text-right">
                <div className="text-sm font-semibold text-sky-400">{author.percentage}%</div>
            </div>
        </div>
    );
}

// Insight Card Component
function InsightCard({
    type,
    title,
    description,
    action,
    onClick,
}: {
    type: 'warning' | 'info' | 'success';
    title: string;
    description: string;
    action: string;
    onClick: () => void;
}) {
    const config = {
        warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' },
        info: { bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-400' },
        success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
    }[type];

    return (
        <div className={cn('p-4 rounded-xl border', config.bg, config.border)}>
            <h4 className={cn('font-semibold mb-1', config.text)}>{title}</h4>
            <p className="text-xs text-slate-400 mb-3">{description}</p>
            <button
                onClick={onClick}
                className={cn('text-xs font-medium', config.text, 'hover:underline')}
            >
                {action} →
            </button>
        </div>
    );
}

export default ProjectDashboard;
