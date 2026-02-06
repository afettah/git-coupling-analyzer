/**
 * Hotspots View
 * 
 * Dedicated view for analyzing hotspot files - files with high churn and coupling.
 * Includes interactive heatmap, sortable tables, and drill-down capabilities.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import {
    Flame, AlertTriangle, Download, SortAsc, SortDesc,
    TrendingUp, GitCommit, Search,
    ChevronRight, LayoutGrid, List, Maximize2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFilters } from '../stores/filterStore';

interface HotspotFile {
    path: string;
    commits: number;
    coupling: number;
    authors: number;
    riskScore: number;
    linesChanged: number;
    lastModified: string;
    folder: string;
    extension: string;
}

interface HotspotsViewProps {
    repoId: string;
}

// Generate mock hotspot data
function generateMockHotspots(): HotspotFile[] {
    const folders = ['src/core', 'src/api', 'src/utils', 'src/db', 'src/auth', 'src/config', 'src/ui', 'src/tests'];
    const extensions = ['ts', 'tsx', 'js', 'py', 'go', 'java'];
    const names = ['handler', 'service', 'controller', 'model', 'utils', 'helper', 'manager', 'provider', 'factory', 'builder'];
    
    const hotspots: HotspotFile[] = [];
    for (let i = 0; i < 50; i++) {
        const folder = folders[Math.floor(Math.random() * folders.length)];
        const ext = extensions[Math.floor(Math.random() * extensions.length)];
        const name = names[Math.floor(Math.random() * names.length)];
        
        const commits = 20 + Math.floor(Math.random() * 250);
        const coupling = 0.1 + Math.random() * 0.9;
        const authors = 1 + Math.floor(Math.random() * 15);
        const linesChanged = commits * (50 + Math.floor(Math.random() * 200));
        
        // Risk score formula: weighted combination of commits, coupling, and authors
        const riskScore = Math.min(100, Math.round(
            (commits / 270) * 40 +
            coupling * 40 +
            (authors / 15) * 20
        ));
        
        hotspots.push({
            path: `${folder}/${name}_${i}.${ext}`,
            commits,
            coupling,
            authors,
            riskScore,
            linesChanged,
            lastModified: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
            folder,
            extension: ext,
        });
    }
    
    return hotspots.sort((a, b) => b.riskScore - a.riskScore);
}

type SortField = 'riskScore' | 'commits' | 'coupling' | 'authors' | 'linesChanged' | 'lastModified';
type ViewMode = 'heatmap' | 'table' | 'treemap';

export function HotspotsView({ repoId }: HotspotsViewProps) {
    const navigate = useNavigate();
    const { filters } = useFilters();
    const [hotspots, setHotspots] = useState<HotspotFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortField, setSortField] = useState<SortField>('riskScore');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('heatmap');
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await new Promise(r => setTimeout(r, 300));
            setHotspots(generateMockHotspots());
            setLoading(false);
        };
        loadData();
    }, [repoId]);

    // Filter and sort hotspots
    const filteredHotspots = useMemo(() => {
        let result = [...hotspots];
        
        // Apply search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(h => h.path.toLowerCase().includes(query));
        }
        
        // Apply folder filter
        if (selectedFolder) {
            result = result.filter(h => h.folder === selectedFolder);
        }
        
        // Apply global filters
        if (filters.churn.minCommits > 0) {
            result = result.filter(h => h.commits >= filters.churn.minCommits);
        }
        if (filters.coupling.minStrength > 0) {
            result = result.filter(h => h.coupling >= filters.coupling.minStrength);
        }
        if (filters.risk.minRiskScore > 0) {
            result = result.filter(h => h.riskScore >= filters.risk.minRiskScore);
        }
        if (filters.files.extensions.length > 0) {
            result = result.filter(h => filters.files.extensions.includes(h.extension));
        }
        
        // Sort
        result.sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];
            const diff = typeof aVal === 'string' ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number);
            return sortDir === 'asc' ? diff : -diff;
        });
        
        return result;
    }, [hotspots, searchQuery, selectedFolder, filters, sortField, sortDir]);

    // Get unique folders for filtering
    const folders = useMemo(() => {
        const folderSet = new Set(hotspots.map(h => h.folder));
        return Array.from(folderSet).sort();
    }, [hotspots]);

    // Stats
    const stats = useMemo(() => {
        const filtered = filteredHotspots;
        return {
            count: filtered.length,
            avgRisk: filtered.length > 0 ? filtered.reduce((acc, h) => acc + h.riskScore, 0) / filtered.length : 0,
            highRisk: filtered.filter(h => h.riskScore >= 70).length,
            totalCommits: filtered.reduce((acc, h) => acc + h.commits, 0),
        };
    }, [filteredHotspots]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const handleExport = () => {
        const csv = [
            ['Path', 'Risk Score', 'Commits', 'Coupling', 'Authors', 'Lines Changed', 'Last Modified'].join(','),
            ...filteredHotspots.map(h => [
                h.path,
                h.riskScore,
                h.commits,
                Math.round(h.coupling * 100) + '%',
                h.authors,
                h.linesChanged,
                new Date(h.lastModified).toLocaleDateString(),
            ].join(','))
        ].join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hotspots-analysis.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
                    <p className="text-slate-500">Analyzing hotspots...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/10 rounded-xl text-red-400">
                        <Flame size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-100">Hotspot Analysis</h1>
                        <p className="text-sm text-slate-500">
                            Files with high churn and coupling that may need refactoring
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
                    >
                        <Download size={16} />
                        Export
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
                <StatCard
                    label="Hotspots Found"
                    value={stats.count}
                    icon={<Flame size={18} />}
                    color="text-amber-400"
                />
                <StatCard
                    label="High Risk Files"
                    value={stats.highRisk}
                    icon={<AlertTriangle size={18} />}
                    color="text-red-400"
                />
                <StatCard
                    label="Avg Risk Score"
                    value={Math.round(stats.avgRisk)}
                    icon={<TrendingUp size={18} />}
                    color="text-purple-400"
                />
                <StatCard
                    label="Total Commits"
                    value={stats.totalCommits.toLocaleString()}
                    icon={<GitCommit size={18} />}
                    color="text-sky-400"
                />
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4 flex-wrap">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search files..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-500 outline-none"
                    />
                </div>

                {/* Folder Filter */}
                <select
                    value={selectedFolder || ''}
                    onChange={(e) => setSelectedFolder(e.target.value || null)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200"
                >
                    <option value="">All Folders</option>
                    {folders.map(f => (
                        <option key={f} value={f}>{f}</option>
                    ))}
                </select>

                {/* View Mode */}
                <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-lg">
                    <button
                        onClick={() => setViewMode('heatmap')}
                        className={cn(
                            'p-2 rounded transition-colors',
                            viewMode === 'heatmap' ? 'bg-sky-500/20 text-sky-400' : 'text-slate-400 hover:text-slate-200'
                        )}
                        title="Heatmap View"
                    >
                        <LayoutGrid size={18} />
                    </button>
                    <button
                        onClick={() => setViewMode('table')}
                        className={cn(
                            'p-2 rounded transition-colors',
                            viewMode === 'table' ? 'bg-sky-500/20 text-sky-400' : 'text-slate-400 hover:text-slate-200'
                        )}
                        title="Table View"
                    >
                        <List size={18} />
                    </button>
                    <button
                        onClick={() => setViewMode('treemap')}
                        className={cn(
                            'p-2 rounded transition-colors',
                            viewMode === 'treemap' ? 'bg-sky-500/20 text-sky-400' : 'text-slate-400 hover:text-slate-200'
                        )}
                        title="Treemap View"
                    >
                        <Maximize2 size={18} />
                    </button>
                </div>
            </div>

            {/* Content */}
            {viewMode === 'heatmap' && (
                <HeatmapView
                    hotspots={filteredHotspots}
                    onFileClick={(path) => navigate(`/repos/${repoId}/file-details/${encodeURIComponent(path)}`)}
                />
            )}

            {viewMode === 'table' && (
                <TableView
                    hotspots={filteredHotspots}
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={handleSort}
                    onFileClick={(path) => navigate(`/repos/${repoId}/file-details/${encodeURIComponent(path)}`)}
                />
            )}

            {viewMode === 'treemap' && (
                <TreemapView
                    hotspots={filteredHotspots}
                    onFileClick={(path) => navigate(`/repos/${repoId}/file-details/${encodeURIComponent(path)}`)}
                />
            )}
        </div>
    );
}

// Stat Card
function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: string }) {
    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className={cn('flex items-center gap-2 mb-2', color)}>
                {icon}
                <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
            </div>
            <div className={cn('text-2xl font-bold', color)}>{value}</div>
        </div>
    );
}

// Heatmap View Component
function HeatmapView({ hotspots, onFileClick }: { hotspots: HotspotFile[]; onFileClick: (path: string) => void }) {
    const getRiskColor = (score: number) => {
        if (score >= 80) return 'bg-red-500/80 hover:bg-red-400';
        if (score >= 60) return 'bg-orange-500/70 hover:bg-orange-400';
        if (score >= 40) return 'bg-amber-500/60 hover:bg-amber-400';
        if (score >= 20) return 'bg-yellow-500/50 hover:bg-yellow-400';
        return 'bg-emerald-500/40 hover:bg-emerald-400';
    };

    const getSize = (commits: number) => {
        if (commits >= 200) return 'w-16 h-16';
        if (commits >= 100) return 'w-14 h-14';
        if (commits >= 50) return 'w-12 h-12';
        return 'w-10 h-10';
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">Risk Heatmap</h3>
            <div className="flex flex-wrap gap-2">
                {hotspots.slice(0, 100).map((h) => (
                    <button
                        key={h.path}
                        onClick={() => onFileClick(h.path)}
                        className={cn(
                            'rounded-lg flex items-center justify-center text-white font-bold text-xs transition-all cursor-pointer',
                            getRiskColor(h.riskScore),
                            getSize(h.commits)
                        )}
                        title={`${h.path}\nRisk: ${h.riskScore} | Commits: ${h.commits} | Coupling: ${Math.round(h.coupling * 100)}%`}
                    >
                        {h.riskScore}
                    </button>
                ))}
            </div>
            
            {/* Legend */}
            <div className="mt-6 flex items-center justify-center gap-4">
                <span className="text-xs text-slate-500">Risk Level:</span>
                <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-emerald-500/40"></span>
                    <span className="text-xs text-slate-400">Low</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-amber-500/60"></span>
                    <span className="text-xs text-slate-400">Medium</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-red-500/80"></span>
                    <span className="text-xs text-slate-400">High</span>
                </div>
            </div>
        </div>
    );
}

// Table View Component
function TableView({
    hotspots,
    sortField,
    sortDir,
    onSort,
    onFileClick,
}: {
    hotspots: HotspotFile[];
    sortField: SortField;
    sortDir: 'asc' | 'desc';
    onSort: (field: SortField) => void;
    onFileClick: (path: string) => void;
}) {
    const SortIcon = sortDir === 'asc' ? SortAsc : SortDesc;

    const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
        <th
            onClick={() => onSort(field)}
            className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-200 transition-colors"
        >
            <div className="flex items-center gap-1">
                {children}
                {sortField === field && <SortIcon size={14} className="text-sky-400" />}
            </div>
        </th>
    );

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full">
                <thead className="bg-slate-800/50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">#</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">File</th>
                        <SortHeader field="riskScore">Risk</SortHeader>
                        <SortHeader field="commits">Commits</SortHeader>
                        <SortHeader field="coupling">Coupling</SortHeader>
                        <SortHeader field="authors">Authors</SortHeader>
                        <SortHeader field="linesChanged">Lines</SortHeader>
                        <SortHeader field="lastModified">Modified</SortHeader>
                        <th className="px-4 py-3"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {hotspots.map((h, i) => {
                        const riskColor = h.riskScore >= 70 ? 'text-red-400 bg-red-500/10' :
                            h.riskScore >= 40 ? 'text-amber-400 bg-amber-500/10' :
                            'text-emerald-400 bg-emerald-500/10';
                        
                        return (
                            <tr
                                key={h.path}
                                className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                                onClick={() => onFileClick(h.path)}
                            >
                                <td className="px-4 py-3 text-sm text-slate-500">{i + 1}</td>
                                <td className="px-4 py-3">
                                    <div className="font-mono text-sm text-slate-300 truncate max-w-xs" title={h.path}>
                                        {h.path.split('/').pop()}
                                    </div>
                                    <div className="text-xs text-slate-500 truncate">{h.folder}</div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={cn('px-2 py-1 rounded-full text-xs font-bold', riskColor)}>
                                        {h.riskScore}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-sky-400">{h.commits}</td>
                                <td className="px-4 py-3 text-sm text-purple-400">{Math.round(h.coupling * 100)}%</td>
                                <td className="px-4 py-3 text-sm text-slate-400">{h.authors}</td>
                                <td className="px-4 py-3 text-sm text-slate-400">{h.linesChanged.toLocaleString()}</td>
                                <td className="px-4 py-3 text-xs text-slate-500">
                                    {new Date(h.lastModified).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3">
                                    <ChevronRight size={16} className="text-slate-600" />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// Treemap View Component
function TreemapView({ hotspots, onFileClick }: { hotspots: HotspotFile[]; onFileClick: (path: string) => void }) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current || hotspots.length === 0) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const height = 500;

        // Clear previous content
        d3.select(container).selectAll('*').remove();

        // Create hierarchy
        const root = d3.hierarchy({ children: hotspots.map(h => ({ ...h, value: h.commits })) })
            .sum((d: any) => d.value || 0)
            .sort((a, b) => (b.value || 0) - (a.value || 0));

        // Create treemap layout
        d3.treemap<any>()
            .size([width, height])
            .padding(2)
            .round(true)(root);

        // Create SVG
        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        // Color scale based on risk
        const colorScale = d3.scaleLinear<string>()
            .domain([0, 50, 100])
            .range(['#34d399', '#fbbf24', '#ef4444']);

        // Create cells
        const cell = svg.selectAll('g')
            .data(root.leaves())
            .enter()
            .append('g')
            .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`);

        cell.append('rect')
            .attr('width', (d: any) => d.x1 - d.x0)
            .attr('height', (d: any) => d.y1 - d.y0)
            .attr('fill', (d: any) => colorScale(d.data.riskScore))
            .attr('rx', 4)
            .style('cursor', 'pointer')
            .style('opacity', 0.8)
            .on('mouseover', function() { d3.select(this).style('opacity', 1); })
            .on('mouseout', function() { d3.select(this).style('opacity', 0.8); })
            .on('click', (_, d: any) => onFileClick(d.data.path));

        cell.append('text')
            .attr('x', 4)
            .attr('y', 14)
            .text((d: any) => {
                const width = d.x1 - d.x0;
                if (width < 60) return '';
                const name = d.data.path.split('/').pop();
                return name.length > width / 7 ? name.slice(0, Math.floor(width / 7)) + '...' : name;
            })
            .attr('fill', 'white')
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .style('pointer-events', 'none');

        cell.append('title')
            .text((d: any) => `${d.data.path}\nRisk: ${d.data.riskScore} | Commits: ${d.data.commits}`);

    }, [hotspots, onFileClick]);

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">Risk Treemap</h3>
            <div ref={containerRef} className="w-full" />
        </div>
    );
}

export default HotspotsView;
