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
    [key: string]: any;
}

interface FolderTreeSettings {
    maxDepth: number;  // Max folder depth to show (files at hidden depths group into visible parent)
    showFiles: boolean; // When false, files are hidden but counted in parent folders
    colorPalette: string[]; // Folder colors by depth level
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
    childFolders?: number;
}

// Default folder color palette - designed for visibility on dark backgrounds
const DEFAULT_FOLDER_PALETTE = [
    '#fbbf24', // amber-400
    '#34d399', // emerald-400
    '#60a5fa', // blue-400
    '#f472b6', // pink-400
    '#a78bfa', // violet-400
    '#2dd4bf', // teal-400
    '#fb923c', // orange-400
    '#818cf8', // indigo-400
    '#4ade80', // green-400
    '#f87171', // red-400
];

// Aggregate file stats into parent folder when files are hidden
function aggregateFileStats(node: TreeNode): { fileCount: number; commits: number; linesAdded: number; linesDeleted: number; authors: Set<number>; childFolders: number } {
    const stats = { fileCount: 0, commits: 0, linesAdded: 0, linesDeleted: 0, authors: new Set<number>(), childFolders: 0 };
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
        } else {
            stats.fileCount++;
            stats.commits += child.commits || 0;
            stats.linesAdded += child.lines_added || 0;
            stats.linesDeleted += child.lines_deleted || 0;
            if (child.authors) stats.authors.add(child.authors);
        }
    }
    return stats;
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
                <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                    <span>1</span>
                    <span>All ({maxAvailableDepth})</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Files in deeper folders are grouped into visible parents</p>
            </div>

            {/* Show Files Toggle */}
            <div className="mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings.showFiles}
                        onChange={(e) => onSettingsChange({ ...settings, showFiles: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900"
                    />
                    <span className="text-xs text-slate-400">Show individual files</span>
                </label>
                {!settings.showFiles && (
                    <p className="text-[10px] text-slate-500 mt-1 ml-6">Files are hidden but counted in folder stats</p>
                )}
            </div>

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
                            title={`Depth ${i + 1}: ${color}`}
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
                    {showPaletteEditor && (
                        <button
                            onClick={() => {
                                // Add a new color from the default palette
                                const nextIndex = settings.colorPalette.length % DEFAULT_FOLDER_PALETTE.length;
                                onSettingsChange({
                                    ...settings,
                                    colorPalette: [...settings.colorPalette, DEFAULT_FOLDER_PALETTE[nextIndex]]
                                });
                            }}
                            className="w-5 h-5 rounded border border-dashed border-slate-500 flex items-center justify-center text-slate-500 hover:border-sky-400 hover:text-sky-400"
                            title="Add color"
                        >
                            +
                        </button>
                    )}
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

// Hover tooltip component
function HoverTooltip({ info, position }: { info: HoverInfo; position: { x: number; y: number } }) {
    return (
        <div
            className="fixed z-50 bg-slate-900 border border-slate-600 rounded-lg shadow-xl p-3 min-w-[200px] max-w-[300px] pointer-events-none"
            style={{
                left: Math.min(position.x + 10, window.innerWidth - 320),
                top: Math.min(position.y + 10, window.innerHeight - 200)
            }}
        >
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700">
                <span className="text-lg">{info.type === 'dir' ? '📁' : '📄'}</span>
                <div className="min-w-0">
                    <div className="font-semibold text-slate-200 text-sm truncate">{info.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{info.path || '/'}</div>
                </div>
            </div>

            <div className="space-y-1.5 text-xs">
                {info.type === 'dir' && info.fileCount !== undefined && (
                    <div className="flex justify-between">
                        <span className="text-slate-400">Files</span>
                        <span className="text-slate-200 font-mono">{info.fileCount}</span>
                    </div>
                )}
                {info.type === 'dir' && info.childFolders !== undefined && info.childFolders > 0 && (
                    <div className="flex justify-between">
                        <span className="text-slate-400">Subfolders</span>
                        <span className="text-slate-200 font-mono">{info.childFolders}</span>
                    </div>
                )}
                {info.commits !== undefined && info.commits > 0 && (
                    <div className="flex justify-between">
                        <span className="text-slate-400">Commits</span>
                        <span className="text-slate-200 font-mono">{info.commits}</span>
                    </div>
                )}
                {(info.linesAdded !== undefined || info.linesDeleted !== undefined) && (
                    <div className="flex justify-between">
                        <span className="text-slate-400">Changes</span>
                        <span className="font-mono">
                            <span className="text-green-400">+{info.linesAdded || 0}</span>
                            <span className="text-slate-500 mx-1">/</span>
                            <span className="text-red-400">-{info.linesDeleted || 0}</span>
                        </span>
                    </div>
                )}
                {info.authors !== undefined && info.authors > 0 && (
                    <div className="flex justify-between">
                        <span className="text-slate-400">Contributors</span>
                        <span className="text-slate-200 font-mono">{info.authors}</span>
                    </div>
                )}
                {info.lastModified && (
                    <div className="flex justify-between">
                        <span className="text-slate-400">Last Modified</span>
                        <span className="text-slate-200 text-[10px]">{info.lastModified}</span>
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

export default function FolderTree({ repoId, onFileSelect }: FolderTreeProps) {
    const [tree, setTree] = useState<Record<string, TreeNode>>({});
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [showSettings, setShowSettings] = useState(false);
    const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [settings, setSettings] = useState<FolderTreeSettings>({
        maxDepth: 100, // Default to unlimited (high number)
        showFiles: true,
        colorPalette: DEFAULT_FOLDER_PALETTE,
    });

    const maxAvailableDepth = useMemo(() => Math.max(calculateMaxDepth(tree) + 1, 1), [tree]);

    // Update maxDepth when tree changes to ensure it's at least maxAvailableDepth
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

    const getFolderColor = useCallback((depth: number) => {
        const palette = settings.colorPalette;
        return palette[depth % palette.length];
    }, [settings.colorPalette]);

    const handleMouseEnter = useCallback((
        e: React.MouseEvent,
        info: HoverInfo
    ) => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        hoverTimeoutRef.current = setTimeout(() => {
            setHoverInfo(info);
            setHoverPosition({ x: e.clientX, y: e.clientY });
        }, 300); // Small delay to avoid flickering
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (hoverInfo) {
            setHoverPosition({ x: e.clientX, y: e.clientY });
        }
    }, [hoverInfo]);

    const handleMouseLeave = useCallback(() => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        setHoverInfo(null);
    }, []);

    const renderNode = (name: string, node: TreeNode, path: string, depth: number) => {
        const fullPath = path ? `${path}/${name}` : name;
        const isDir = node.__type === 'dir' || node.__children;
        const isExpanded = expanded.has(fullPath);
        const folderColor = getFolderColor(depth);

        // Check if we've reached max folder depth - only affects subfolder visibility, not files
        const atMaxFolderDepth = depth >= settings.maxDepth;

        if (isDir) {
            const children = node.__children || {};
            const stats = aggregateFileStats(node);

            // Filter children based on settings
            // Depth limit only hides sub-folders, files are always shown if showFiles is enabled
            const filteredChildren = Object.entries(children).filter(([, childNode]) => {
                const childIsDir = childNode.__type === 'dir' || childNode.__children;
                // If child is a folder and we're at max depth, don't show it
                if (childIsDir && atMaxFolderDepth) return false;
                // If not showing files, don't show file nodes (but they're counted in stats)
                if (!settings.showFiles && !childIsDir) return false;
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
            };

            return (
                <div key={fullPath}>
                    <div
                        className="group flex items-center gap-1 py-1.5 px-2 hover:bg-slate-800/70 rounded cursor-pointer text-sm transition-colors relative"
                        style={{ paddingLeft: `${depth * 16 + 8}px` }}
                        onClick={() => toggleExpand(fullPath)}
                        onMouseEnter={(e) => handleMouseEnter(e, hoverData)}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                    >
                        <span className="text-slate-500 text-xs w-3">{isExpanded ? '▼' : '▶'}</span>
                        <span style={{ color: folderColor }}>📁</span>
                        <span className="text-slate-300 flex-1 truncate">{name}</span>

                        {/* Inline info badge on hover */}
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-[10px] text-slate-500">
                            {stats.fileCount > 0 && (
                                <span title="Files" className="flex items-center gap-0.5">
                                    📄 {stats.fileCount}
                                </span>
                            )}
                            {stats.childFolders > 0 && (
                                <span title="Subfolders" className="flex items-center gap-0.5">
                                    📁 {stats.childFolders}
                                </span>
                            )}
                            {stats.commits > 0 && (
                                <span title="Commits" className="flex items-center gap-0.5">
                                    ⚡ {stats.commits}
                                </span>
                            )}
                        </span>
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

        // Don't render files if showFiles is disabled (they're aggregated into parent)
        if (!settings.showFiles) {
            return null;
        }

        const fileHoverData: HoverInfo = {
            name,
            path: fullPath,
            type: 'file',
            commits: node.commits,
            linesAdded: node.lines_added,
            linesDeleted: node.lines_deleted,
            authors: node.authors,
            lastModified: node.last_modified,
        };

        // File node
        return (
            <div
                key={fullPath}
                className="group flex items-center gap-1 py-1.5 px-2 hover:bg-slate-800/70 rounded cursor-pointer text-sm transition-colors"
                style={{ paddingLeft: `${depth * 16 + 24}px` }}
                onClick={() => onFileSelect?.(fullPath)}
                onMouseEnter={(e) => handleMouseEnter(e, fileHoverData)}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                <span className="text-sky-400">📄</span>
                <span className="text-slate-400 flex-1 truncate">{name}</span>

                {/* Inline info on hover */}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-[10px] text-slate-500">
                    {node.commits && (
                        <span title="Commits">⚡ {node.commits}</span>
                    )}
                </span>

                {/* Always visible commit count */}
                {node.commits && (
                    <span className="text-xs text-slate-600 group-hover:hidden">{node.commits}</span>
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

            {/* Hover tooltip */}
            {hoverInfo && <HoverTooltip info={hoverInfo} position={hoverPosition} />}
        </div>
    );
}
