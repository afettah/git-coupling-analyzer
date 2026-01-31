import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getFileTree } from '../api';

interface FolderTreeProps {
    repoId: string;
    onFileSelect?: (path: string) => void;
}

interface TreeNode {
    __type?: 'file' | 'dir';
    __children?: Record<string, TreeNode>;
    file_id?: number;
    commits?: number;
    lines_added?: number;
    lines_deleted?: number;
    authors?: number;
    last_modified?: string;
    last_author?: string;
    coupled_count?: number;
    max_coupling?: number;
    avg_coupling?: number;
    strong_coupling_count?: number;
    [key: string]: any;
}

interface FolderTreeSettings {
    maxDepth: number;
    showFiles: boolean;
    colorPalette: string[];
    showHints: boolean;
    hintDensity: 'compact' | 'normal' | 'detailed';
}

interface HoverInfo {
    name: string;
    path: string;
    type: 'file' | 'dir';
    fileCount?: number;
    commits?: number;
    linesAdded?: number;
    linesDeleted?: number;
    authors?: number;
    lastModified?: string;
    lastAuthor?: string;
    childFolders?: number;
    coupledCount?: number;
    maxCoupling?: number;
    strongCouplingCount?: number;
}

type QuickFilter = 'hot' | 'stable' | 'recent' | 'coupled' | 'risky';

const DEFAULT_FOLDER_PALETTE = [
    '#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa',
    '#2dd4bf', '#fb923c', '#818cf8', '#4ade80', '#f87171',
];

// Aggregate file stats into parent folder
function aggregateFileStats(node: TreeNode): {
    fileCount: number;
    commits: number;
    linesAdded: number;
    linesDeleted: number;
    authors: Set<string>;
    childFolders: number;
    coupledCount: number;
    maxCoupling: number;
    strongCouplingCount: number;
    lastModified?: string;
    lastAuthor?: string;
} {
    const stats = {
        fileCount: 0,
        commits: 0,
        linesAdded: 0,
        linesDeleted: 0,
        authors: new Set<string>(),
        childFolders: 0,
        coupledCount: 0,
        maxCoupling: 0,
        strongCouplingCount: 0,
        lastModified: undefined as string | undefined,
        lastAuthor: undefined as string | undefined,
    };

    const children = node.__children || {};

    for (const child of Object.values(children)) {
        const isDir = child.__type === 'dir' || child.__children;
        if (isDir) {
            stats.childFolders++;
            const childStats = aggregateFileStats(child);
            stats.fileCount += childStats.fileCount;
            stats.commits += childStats.commits;
            stats.linesAdded += childStats.linesAdded;
            stats.linesDeleted += childStats.linesDeleted;
            childStats.authors.forEach(a => stats.authors.add(a));
            stats.childFolders += childStats.childFolders;
            stats.coupledCount += childStats.coupledCount;
            stats.maxCoupling = Math.max(stats.maxCoupling, childStats.maxCoupling);
            stats.strongCouplingCount += childStats.strongCouplingCount;
            if (childStats.lastModified && (!stats.lastModified || childStats.lastModified > stats.lastModified)) {
                stats.lastModified = childStats.lastModified;
                stats.lastAuthor = childStats.lastAuthor;
            }
        } else {
            stats.fileCount++;
            stats.commits += child.commits || 0;
            stats.linesAdded += child.lines_added || 0;
            stats.linesDeleted += child.lines_deleted || 0;
            if (child.last_author) stats.authors.add(child.last_author);
            stats.coupledCount += child.coupled_count || 0;
            stats.maxCoupling = Math.max(stats.maxCoupling, child.max_coupling || 0);
            stats.strongCouplingCount += child.strong_coupling_count || 0;
            if (child.last_modified && (!stats.lastModified || child.last_modified > stats.lastModified)) {
                stats.lastModified = child.last_modified;
                stats.lastAuthor = child.last_author;
            }
        }
    }
    return stats;
}

// Check if file matches filter criteria
function matchesFilter(node: TreeNode, filter: QuickFilter): boolean {
    if (node.__type === 'dir' || node.__children) return false;

    switch (filter) {
        case 'hot':
            return (node.commits || 0) > 30;
        case 'stable':
            return (node.commits || 0) < 5;
        case 'recent':
            if (!node.last_modified) return false;
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return new Date(node.last_modified) > thirtyDaysAgo;
        case 'coupled':
            return (node.strong_coupling_count || 0) > 0 || (node.max_coupling || 0) > 0.5;
        case 'risky':
            return (node.commits || 0) > 20 && (node.authors || 0) > 3;
        default:
            return true;
    }
}

// Churn badge color
function getChurnColor(commits: number): string {
    if (commits > 50) return 'text-red-400';
    if (commits > 20) return 'text-amber-400';
    return 'text-emerald-400';
}

// Coupling badge color
function getCouplingColor(score: number): string {
    if (score > 0.7) return 'text-purple-400';
    if (score > 0.4) return 'text-purple-300';
    return 'text-purple-200';
}

// Recency indicator
function getRecencyIndicator(lastModified?: string): { color: string; label: string } {
    if (!lastModified) return { color: 'text-slate-600', label: '○' };

    const date = new Date(lastModified);
    const now = new Date();
    const daysAgo = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (daysAgo > 365) return { color: 'text-slate-600', label: '○' };
    if (daysAgo > 180) return { color: 'text-emerald-400', label: '●' };
    if (daysAgo > 30) return { color: 'text-amber-400', label: '●' };
    return { color: 'text-red-400', label: '●' };
}

// Format relative time
function formatRelativeTime(dateStr?: string): string {
    if (!dateStr) return '';
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

// Settings panel component
function SettingsPanel({
    settings,
    onSettingsChange,
    maxAvailableDepth
}: {
    settings: FolderTreeSettings;
    onSettingsChange: (settings: FolderTreeSettings) => void;
    maxAvailableDepth: number;
}) {
    const [showPaletteEditor, setShowPaletteEditor] = useState(false);

    return (
        <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Settings</span>
            </div>

            {/* Folder Depth Slider */}
            <div className="mb-3">
                <label className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Folder Depth</span>
                    <span className="text-slate-300 font-mono">
                        {settings.maxDepth >= maxAvailableDepth ? 'All' : `${settings.maxDepth} level${settings.maxDepth > 1 ? 's' : ''}`}
                    </span>
                </label>
                <input
                    type="range"
                    min={1}
                    max={maxAvailableDepth}
                    value={Math.min(settings.maxDepth, maxAvailableDepth)}
                    onChange={(e) => onSettingsChange({ ...settings, maxDepth: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
            </div>

            {/* Show Files Toggle */}
            <div className="mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings.showFiles}
                        onChange={(e) => onSettingsChange({ ...settings, showFiles: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500"
                    />
                    <span className="text-xs text-slate-400">Show individual files</span>
                </label>
            </div>

            {/* Show Hints Toggle */}
            <div className="mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings.showHints}
                        onChange={(e) => onSettingsChange({ ...settings, showHints: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500"
                    />
                    <span className="text-xs text-slate-400">Show visual hints</span>
                </label>
            </div>

            {/* Hint Density */}
            {settings.showHints && (
                <div className="mb-3">
                    <label className="text-xs text-slate-400 mb-1 block">Hint Density</label>
                    <div className="flex gap-2">
                        {(['compact', 'normal', 'detailed'] as const).map(density => (
                            <button
                                key={density}
                                onClick={() => onSettingsChange({ ...settings, hintDensity: density })}
                                className={`px-2 py-1 text-xs rounded ${settings.hintDensity === density
                                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/50'
                                        : 'bg-slate-700 text-slate-400 border border-slate-600 hover:border-slate-500'
                                    }`}
                            >
                                {density}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Color Palette */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">Folder Colors</span>
                    <button
                        onClick={() => setShowPaletteEditor(!showPaletteEditor)}
                        className="text-[10px] text-sky-400 hover:text-sky-300"
                    >
                        {showPaletteEditor ? 'Done' : 'Edit'}
                    </button>
                </div>
                <div className="flex flex-wrap gap-1">
                    {settings.colorPalette.map((color, i) => (
                        <div
                            key={i}
                            className="w-5 h-5 rounded border border-slate-600 cursor-pointer hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                            title={`Depth ${i + 1}`}
                            onClick={() => {
                                if (showPaletteEditor) {
                                    const input = document.createElement('input');
                                    input.type = 'color';
                                    input.value = color;
                                    input.onchange = (e) => {
                                        const newPalette = [...settings.colorPalette];
                                        newPalette[i] = (e.target as HTMLInputElement).value;
                                        onSettingsChange({ ...settings, colorPalette: newPalette });
                                    };
                                    input.click();
                                }
                            }}
                        />
                    ))}
                </div>
                {showPaletteEditor && (
                    <button
                        onClick={() => onSettingsChange({ ...settings, colorPalette: DEFAULT_FOLDER_PALETTE })}
                        className="text-[10px] text-slate-500 hover:text-slate-400 mt-2"
                    >
                        Reset to default
                    </button>
                )}
            </div>
        </div>
    );
}

// Quick Filters Bar
function QuickFiltersBar({
    activeFilters,
    onToggle,
    filterCounts,
}: {
    activeFilters: Set<QuickFilter>;
    onToggle: (filter: QuickFilter) => void;
    filterCounts: Record<QuickFilter, number>;
}) {
    const filters: { id: QuickFilter; icon: string; label: string; color: string }[] = [
        { id: 'hot', icon: '🔥', label: 'Hot Files', color: 'text-red-400 bg-red-400/10 border-red-400/30' },
        { id: 'stable', icon: '❄️', label: 'Stable', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
        { id: 'recent', icon: '🕐', label: 'Recent', color: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },
        { id: 'coupled', icon: '🔗', label: 'Coupled', color: 'text-purple-400 bg-purple-400/10 border-purple-400/30' },
        { id: 'risky', icon: '⚠️', label: 'Risk', color: 'text-orange-400 bg-orange-400/10 border-orange-400/30' },
    ];

    return (
        <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-slate-700">
            {filters.map(f => {
                const isActive = activeFilters.has(f.id);
                const count = filterCounts[f.id];
                return (
                    <button
                        key={f.id}
                        onClick={() => onToggle(f.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all ${isActive
                                ? f.color
                                : 'text-slate-400 bg-slate-800/50 border-slate-600 hover:border-slate-500'
                            }`}
                    >
                        <span>{f.icon}</span>
                        <span>{f.label}</span>
                        {count > 0 && (
                            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white/20' : 'bg-slate-700'
                                }`}>
                                {count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

// File Hints Badge Component
function FileHints({
    node,
    density,
}: {
    node: TreeNode;
    density: 'compact' | 'normal' | 'detailed';
}) {
    const commits = node.commits || 0;
    const coupling = node.max_coupling || 0;
    const strongCoupling = node.strong_coupling_count || 0;
    const authors = node.authors || 0;
    const recency = getRecencyIndicator(node.last_modified);

    if (density === 'compact') {
        return (
            <span className="flex items-center gap-1 text-[10px]">
                {commits > 10 && <span className={getChurnColor(commits)}>🔥</span>}
                {coupling > 0.3 && <span className={getCouplingColor(coupling)}>🔗</span>}
                <span className={recency.color}>{recency.label}</span>
            </span>
        );
    }

    if (density === 'normal') {
        return (
            <span className="flex items-center gap-2 text-[10px]">
                <span className={`flex items-center gap-0.5 ${getChurnColor(commits)}`}>
                    🔥 {commits}
                </span>
                {coupling > 0.2 && (
                    <span className={`flex items-center gap-0.5 ${getCouplingColor(coupling)}`}>
                        🔗 {(coupling * 100).toFixed(0)}%
                    </span>
                )}
                <span className={recency.color}>{recency.label}</span>
                {authors > 1 && <span className="text-slate-500">👤{authors}</span>}
            </span>
        );
    }

    // Detailed
    return (
        <span className="flex items-center gap-2 text-[10px]">
            <span className={`flex items-center gap-0.5 ${getChurnColor(commits)}`} title="Total commits">
                🔥 {commits}
            </span>
            {(node.lines_added || node.lines_deleted) ? (
                <span className="flex items-center gap-0.5" title="Lines changed">
                    <span className="text-emerald-400">+{node.lines_added || 0}</span>
                    <span className="text-red-400">-{node.lines_deleted || 0}</span>
                </span>
            ) : null}
            {coupling > 0 && (
                <span className={`flex items-center gap-0.5 ${getCouplingColor(coupling)}`} title={`Max coupling: ${(coupling * 100).toFixed(0)}%`}>
                    🔗 {strongCoupling > 0 ? `${strongCoupling}×` : `${(coupling * 100).toFixed(0)}%`}
                </span>
            )}
            {authors > 0 && (
                <span className="text-slate-500 flex items-center gap-0.5" title="Contributors">
                    👤 {authors}
                </span>
            )}
            <span className={recency.color} title={node.last_modified ? `Last: ${formatRelativeTime(node.last_modified)}` : 'No recent changes'}>
                {recency.label}
            </span>
            {node.last_modified && (
                <span className="text-slate-600">{formatRelativeTime(node.last_modified)}</span>
            )}
        </span>
    );
}

// Hover tooltip component
function HoverTooltip({ info, position }: { info: HoverInfo; position: { x: number; y: number } }) {
    return (
        <div
            className="fixed z-50 bg-slate-900 border border-slate-600 rounded-lg shadow-xl p-3 min-w-[240px] max-w-[320px] pointer-events-none"
            style={{
                left: Math.min(position.x + 10, window.innerWidth - 340),
                top: Math.min(position.y + 10, window.innerHeight - 300)
            }}
        >
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700">
                <span className="text-lg">{info.type === 'dir' ? '📁' : '📄'}</span>
                <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-200 text-sm truncate">{info.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{info.path || '/'}</div>
                </div>
            </div>

            <div className="space-y-2 text-xs">
                {/* Directory specific stats */}
                {info.type === 'dir' && (
                    <div className="grid grid-cols-2 gap-2">
                        {info.fileCount !== undefined && (
                            <div className="flex flex-col">
                                <span className="text-slate-500 text-[10px]">Files</span>
                                <span className="text-slate-200 font-semibold">{info.fileCount}</span>
                            </div>
                        )}
                        {info.childFolders !== undefined && info.childFolders > 0 && (
                            <div className="flex flex-col">
                                <span className="text-slate-500 text-[10px]">Subfolders</span>
                                <span className="text-slate-200 font-semibold">{info.childFolders}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Commit stats */}
                {info.commits !== undefined && info.commits > 0 && (
                    <div className="flex items-center justify-between py-1 border-t border-slate-800">
                        <span className="text-slate-400 flex items-center gap-1">
                            <span className={getChurnColor(info.commits)}>🔥</span> Commits
                        </span>
                        <span className={`font-mono font-semibold ${getChurnColor(info.commits)}`}>{info.commits}</span>
                    </div>
                )}

                {/* Lines changed */}
                {(info.linesAdded !== undefined || info.linesDeleted !== undefined) && (info.linesAdded || info.linesDeleted) ? (
                    <div className="flex items-center justify-between py-1 border-t border-slate-800">
                        <span className="text-slate-400">Changes</span>
                        <span className="font-mono">
                            <span className="text-emerald-400">+{info.linesAdded || 0}</span>
                            <span className="text-slate-600 mx-1">/</span>
                            <span className="text-red-400">-{info.linesDeleted || 0}</span>
                        </span>
                    </div>
                ) : null}

                {/* Authors */}
                {info.authors !== undefined && info.authors > 0 && (
                    <div className="flex items-center justify-between py-1 border-t border-slate-800">
                        <span className="text-slate-400">👤 Contributors</span>
                        <span className="text-slate-200 font-semibold">{info.authors}</span>
                    </div>
                )}

                {/* Coupling stats */}
                {info.coupledCount !== undefined && info.coupledCount > 0 && (
                    <div className="py-1 border-t border-slate-800">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400">🔗 Coupled Files</span>
                            <span className="text-purple-400 font-semibold">{info.coupledCount}</span>
                        </div>
                        {info.maxCoupling !== undefined && info.maxCoupling > 0 && (
                            <div className="flex items-center justify-between mt-1">
                                <span className="text-slate-500 text-[10px]">Max Coupling</span>
                                <div className="flex items-center gap-1">
                                    <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-purple-500 rounded-full"
                                            style={{ width: `${info.maxCoupling * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-purple-400 text-[10px]">{(info.maxCoupling * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                        )}
                        {info.strongCouplingCount !== undefined && info.strongCouplingCount > 0 && (
                            <div className="flex items-center justify-between mt-1">
                                <span className="text-slate-500 text-[10px]">Strong Couplings (&gt;50%)</span>
                                <span className="text-purple-300 text-[10px]">{info.strongCouplingCount}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Last modified */}
                {info.lastModified && (
                    <div className="flex items-center justify-between py-1 border-t border-slate-800">
                        <span className="text-slate-400">Last Modified</span>
                        <div className="text-right">
                            <div className="text-slate-200 text-[10px]">{formatRelativeTime(info.lastModified)}</div>
                            {info.lastAuthor && (
                                <div className="text-slate-500 text-[10px]">by {info.lastAuthor}</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Calculate max depth of tree
function calculateMaxDepth(tree: Record<string, TreeNode>, currentDepth = 0): number {
    let maxDepth = currentDepth;
    for (const node of Object.values(tree)) {
        if (node.__children) {
            const childDepth = calculateMaxDepth(node.__children, currentDepth + 1);
            maxDepth = Math.max(maxDepth, childDepth);
        }
    }
    return maxDepth;
}

// Count files matching each filter
function countFilters(tree: Record<string, TreeNode>): Record<QuickFilter, number> {
    const counts: Record<QuickFilter, number> = {
        hot: 0, stable: 0, recent: 0, coupled: 0, risky: 0
    };

    function traverse(node: TreeNode) {
        if (node.__type === 'file') {
            for (const filter of Object.keys(counts) as QuickFilter[]) {
                if (matchesFilter(node, filter)) {
                    counts[filter]++;
                }
            }
        }
        if (node.__children) {
            for (const child of Object.values(node.__children)) {
                traverse(child);
            }
        }
    }

    for (const node of Object.values(tree)) {
        traverse(node);
    }

    return counts;
}

export default function FolderTree({ repoId, onFileSelect }: FolderTreeProps) {
    const [tree, setTree] = useState<Record<string, TreeNode>>({});
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [showSettings, setShowSettings] = useState(false);
    const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
    const [activeFilters, setActiveFilters] = useState<Set<QuickFilter>>(new Set());
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [settings, setSettings] = useState<FolderTreeSettings>({
        maxDepth: 100,
        showFiles: true,
        colorPalette: DEFAULT_FOLDER_PALETTE,
        showHints: true,
        hintDensity: 'normal',
    });

    const maxAvailableDepth = useMemo(() => Math.max(calculateMaxDepth(tree) + 1, 1), [tree]);
    const filterCounts = useMemo(() => countFilters(tree), [tree]);

    useEffect(() => {
        if (settings.maxDepth > maxAvailableDepth) {
            setSettings(s => ({ ...s, maxDepth: maxAvailableDepth }));
        }
    }, [maxAvailableDepth]);

    useEffect(() => {
        loadTree();
    }, [repoId]);

    const loadTree = async () => {
        setLoading(true);
        try {
            const data = await getFileTree(repoId);
            setTree(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (path: string) => {
        const next = new Set(expanded);
        if (next.has(path)) {
            next.delete(path);
        } else {
            next.add(path);
        }
        setExpanded(next);
    };

    const toggleFilter = (filter: QuickFilter) => {
        const next = new Set(activeFilters);
        if (next.has(filter)) {
            next.delete(filter);
        } else {
            next.add(filter);
        }
        setActiveFilters(next);
    };

    const getFolderColor = useCallback((depth: number) => {
        const palette = settings.colorPalette;
        return palette[depth % palette.length];
    }, [settings.colorPalette]);

    const handleMouseEnter = useCallback((e: React.MouseEvent, info: HoverInfo) => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
            setHoverInfo(info);
            setHoverPosition({ x: e.clientX, y: e.clientY });
        }, 300);
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (hoverInfo) setHoverPosition({ x: e.clientX, y: e.clientY });
    }, [hoverInfo]);

    const handleMouseLeave = useCallback(() => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setHoverInfo(null);
    }, []);

    // Check if node should be visible based on active filters
    const isNodeVisible = useCallback((node: TreeNode, isDir: boolean): boolean => {
        if (activeFilters.size === 0) return true;

        if (isDir) {
            const children = node.__children || {};
            for (const child of Object.values(children)) {
                const childIsDir = child.__type === 'dir' || !!child.__children;
                if (isNodeVisible(child, childIsDir)) return true;
            }
            return false;
        }

        for (const filter of activeFilters) {
            if (matchesFilter(node, filter)) return true;
        }
        return false;
    }, [activeFilters]);

    const renderNode = (name: string, node: TreeNode, path: string, depth: number) => {
        const fullPath = path ? `${path}/${name}` : name;
        const isDir = node.__type === 'dir' || !!node.__children;
        const isExpanded = expanded.has(fullPath);
        const folderColor = getFolderColor(depth);
        const atMaxFolderDepth = depth >= settings.maxDepth;

        if (!isNodeVisible(node, isDir)) return null;

        if (isDir) {
            const children = node.__children || {};
            const stats = aggregateFileStats(node);

            const filteredChildren = Object.entries(children).filter(([, childNode]) => {
                const childIsDir = childNode.__type === 'dir' || !!childNode.__children;
                if (childIsDir && atMaxFolderDepth) return false;
                if (!settings.showFiles && !childIsDir) return false;
                if (!isNodeVisible(childNode, childIsDir)) return false;
                return true;
            });

            const hoverData: HoverInfo = {
                name,
                path: fullPath,
                type: 'dir',
                fileCount: stats.fileCount,
                childFolders: stats.childFolders,
                commits: stats.commits,
                linesAdded: stats.linesAdded,
                linesDeleted: stats.linesDeleted,
                authors: stats.authors.size,
                coupledCount: stats.coupledCount,
                maxCoupling: stats.maxCoupling,
                strongCouplingCount: stats.strongCouplingCount,
                lastModified: stats.lastModified,
                lastAuthor: stats.lastAuthor,
            };

            const folderActivity = stats.commits > 100 ? 'hot' : stats.commits > 30 ? 'active' : 'normal';

            return (
                <div key={fullPath}>
                    <div
                        className={`group flex items-center gap-1 py-1.5 px-2 hover:bg-slate-800/70 rounded cursor-pointer text-sm transition-colors relative ${folderActivity === 'hot' ? 'bg-red-500/5' :
                                folderActivity === 'active' ? 'bg-amber-500/5' : ''
                            }`}
                        style={{ paddingLeft: `${depth * 16 + 8}px` }}
                        onClick={() => toggleExpand(fullPath)}
                        onMouseEnter={(e) => handleMouseEnter(e, hoverData)}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                    >
                        <span className="text-slate-500 text-xs w-3">{isExpanded ? '▼' : '▶'}</span>
                        <span style={{ color: folderColor }}>📁</span>
                        <span className="text-slate-300 flex-1 truncate">{name}</span>

                        {settings.showHints && (
                            <span className="flex items-center gap-2 text-[10px] text-slate-500">
                                <span title="Files">📄 {stats.fileCount}</span>
                                <span className={getChurnColor(stats.commits)} title="Total commits">
                                    ⚡ {stats.commits}
                                </span>
                                {stats.maxCoupling > 0.3 && (
                                    <span className={getCouplingColor(stats.maxCoupling)} title="Max coupling">
                                        🔗
                                    </span>
                                )}
                                {stats.lastModified && (
                                    <span className="text-slate-600">{formatRelativeTime(stats.lastModified)}</span>
                                )}
                            </span>
                        )}
                    </div>
                    {isExpanded && (
                        <div>
                            {filteredChildren
                                .sort(([a, nodeA], [b, nodeB]) => {
                                    const aIsDir = nodeA.__type === 'dir' || nodeA.__children;
                                    const bIsDir = nodeB.__type === 'dir' || nodeB.__children;
                                    if (aIsDir && !bIsDir) return -1;
                                    if (!aIsDir && bIsDir) return 1;
                                    return a.localeCompare(b);
                                })
                                .map(([childName, childNode]) =>
                                    renderNode(childName, childNode, fullPath, depth + 1)
                                )}
                        </div>
                    )}
                </div>
            );
        }

        if (!settings.showFiles) return null;

        const fileHoverData: HoverInfo = {
            name,
            path: fullPath,
            type: 'file',
            commits: node.commits,
            linesAdded: node.lines_added,
            linesDeleted: node.lines_deleted,
            authors: node.authors,
            lastModified: node.last_modified,
            lastAuthor: node.last_author,
            coupledCount: node.coupled_count,
            maxCoupling: node.max_coupling,
            strongCouplingCount: node.strong_coupling_count,
        };

        const isHotFile = (node.commits || 0) > 30;
        const isHighCoupling = (node.max_coupling || 0) > 0.5;

        return (
            <div
                key={fullPath}
                className={`group flex items-center gap-1 py-1.5 px-2 hover:bg-slate-800/70 rounded cursor-pointer text-sm transition-colors ${isHotFile ? 'bg-red-500/5' : isHighCoupling ? 'bg-purple-500/5' : ''
                    }`}
                style={{ paddingLeft: `${depth * 16 + 24}px` }}
                onClick={() => onFileSelect?.(fullPath)}
                onMouseEnter={(e) => handleMouseEnter(e, fileHoverData)}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                <span className="text-sky-400">📄</span>
                <span className="text-slate-400 flex-1 truncate">{name}</span>

                {settings.showHints && (
                    <FileHints node={node} density={settings.hintDensity} />
                )}

                {!settings.showHints && node.commits && (
                    <span className="text-xs text-slate-600">{node.commits}</span>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <span className="text-slate-500">Loading...</span>
            </div>
        );
    }

    return (
        <div className="p-4 overflow-auto relative">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-400">Current Files</h3>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`p-1.5 rounded transition-colors ${showSettings
                        ? 'bg-sky-500/20 text-sky-400'
                        : 'text-slate-500 hover:text-slate-400 hover:bg-slate-800'
                        }`}
                    title="Settings"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
            </div>

            {showSettings && (
                <SettingsPanel
                    settings={settings}
                    onSettingsChange={setSettings}
                    maxAvailableDepth={maxAvailableDepth}
                />
            )}

            <QuickFiltersBar
                activeFilters={activeFilters}
                onToggle={toggleFilter}
                filterCounts={filterCounts}
            />

            <div className="font-mono text-xs">
                {Object.entries(tree)
                    .sort(([a, nodeA], [b, nodeB]) => {
                        const aIsDir = nodeA.__type === 'dir' || nodeA.__children;
                        const bIsDir = nodeB.__type === 'dir' || nodeB.__children;
                        if (aIsDir && !bIsDir) return -1;
                        if (!aIsDir && bIsDir) return 1;
                        return a.localeCompare(b);
                    })
                    .map(([name, node]) => renderNode(name, node, '', 0))}
            </div>

            {hoverInfo && <HoverTooltip info={hoverInfo} position={hoverPosition} />}
        </div>
    );
}
