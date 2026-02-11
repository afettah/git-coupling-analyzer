/**
 * Cluster Card Component (Refactored)
 * 
 * Displays a summary card for a single cluster with clickable files.
 */

import { useMemo, useState, useCallback } from 'react';
import { Flame, FolderTree, FileText, ExternalLink, FileSearch } from 'lucide-react';
import type { ClusterData, RepoUrlConfig } from '../types';
import { aggregateFolders, formatNumber, formatPercent, getFileName, getFolderPath, buildFileUrl, countUniqueFolders } from '../utils';
import { ProgressBar } from '@/shared';

export interface ClusterCardProps {
    cluster: ClusterData;
    folderDepth: number;
    onExplore: () => void;
    onExport: () => void;
    repoUrlConfig?: RepoUrlConfig;
    onFileSelect?: (path: string) => void;
}

export function ClusterCard({
    cluster,
    folderDepth,
    onExplore,
    onExport,
    repoUrlConfig,
    onFileSelect
}: ClusterCardProps) {
    const [pathMode, setPathMode] = useState<'name' | 'path'>('name');

    const files = cluster.files || [];
    const fileCount = files.length || cluster.size || 0;

    const topFolders = useMemo(
        () => aggregateFolders(files, folderDepth).slice(0, 3),
        [files, folderDepth]
    );

    const previewFiles = useMemo(() => {
        const hotPaths = new Set((cluster.hot_files || []).map((h: { path: string }) => h.path));
        const sorted = [...files].sort((a, b) => a.localeCompare(b));
        // Show hot files first
        const preferred = sorted.filter(f => hotPaths.has(f))
            .concat(sorted.filter(f => !hotPaths.has(f)));
        return preferred.slice(0, 5);
    }, [files, cluster.hot_files]);

    const togglePathMode = useCallback(() => {
        setPathMode(prev => prev === 'name' ? 'path' : 'name');
    }, []);

    // Get coupling color based on strength
    const getCouplingColor = (coupling: number): 'success' | 'warning' | 'danger' => {
        if (coupling >= 0.8) return 'danger';
        if (coupling >= 0.6) return 'warning';
        return 'success';
    };

    // Compute unique folder count
    const uniqueFolderCount = useMemo(
        () => countUniqueFolders(files, folderDepth),
        [files, folderDepth]
    );

    return (
        <div className="border border-slate-800 bg-slate-900/80 rounded-2xl p-5 space-y-4 hover:border-slate-700 transition-colors">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                        <FolderTree className="w-4 h-4 text-sky-400 flex-shrink-0" />
                        <span className="truncate">{cluster.name}</span>
                    </div>
                </div>
            </div>

            {/* Coupling Bar - Primary Metric */}
            <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Coupling</span>
                    <span className="font-semibold text-slate-200">
                        {formatPercent(cluster.avg_coupling)}
                    </span>
                </div>
                <ProgressBar
                    value={(cluster.avg_coupling || 0) * 100}
                    max={100}
                    color={getCouplingColor(cluster.avg_coupling || 0)}
                    size="md"
                />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3 text-xs">
                <StatItem label="Files" value={formatNumber(fileCount)} />
                <StatItem label="Folders" value={formatNumber(uniqueFolderCount)} />
                <StatItem label="Churn" value={formatNumber(cluster.total_churn)} />
            </div>

            {/* Top Folders */}
            <div>
                <div className="text-xs uppercase text-slate-500 mb-2">Top folders</div>
                <div className="space-y-1 text-sm text-slate-200">
                    {topFolders.length === 0 ? (
                        <div className="text-xs text-slate-500">No folders detected</div>
                    ) : (
                        topFolders.map(folder => (
                            <div key={folder.path} className="flex items-center justify-between">
                                <span className="truncate">{folder.path}</span>
                                <span className="text-xs text-slate-500 flex-shrink-0 ml-2">
                                    {folder.count} files
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Preview Files */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <div className="text-xs uppercase text-slate-500">Preview files</div>
                    <button data-testid="cluster-card-btn-btn-1"
                        onClick={togglePathMode}
                        className="text-xs text-slate-500 hover:text-slate-300"
                    >
                        {pathMode === 'name' ? 'Show path' : 'Show name'}
                    </button>
                </div>
                <div className="space-y-2 text-sm">
                    {previewFiles.map(file => {
                        const isHot = (cluster.hot_files || []).some((h: { path: string }) => h.path === file);
                        return (
                            <FilePreviewItem
                                key={file}
                                file={file}
                                isHot={isHot}
                                pathMode={pathMode}
                                folderDepth={folderDepth}
                                repoUrlConfig={repoUrlConfig}
                                onFileSelect={onFileSelect}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
                <button data-testid="cluster-card-btn-btn-2"
                    onClick={onExplore}
                    className="text-sm text-sky-400 hover:text-sky-300"
                >
                    Show all {fileCount} files
                </button>
                <div className="flex items-center gap-2">
                    <button data-testid="cluster-card-btn-btn-3"
                        onClick={onExport}
                        className="px-3 py-1.5 text-xs rounded-lg border border-slate-800 text-slate-300 hover:text-slate-100 hover:border-slate-700"
                    >
                        Export
                    </button>
                    <button data-testid="cluster-card-btn-btn-4"
                        onClick={onExplore}
                        className="px-3 py-1.5 text-xs rounded-lg bg-sky-500 text-slate-900 font-semibold hover:bg-sky-400"
                    >
                        Explore
                    </button>
                </div>
            </div>
        </div>
    );
}

interface StatItemProps {
    label: string;
    value: string;
}

function StatItem({ label, value }: StatItemProps) {
    return (
        <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
            <div className="text-slate-500">{label}</div>
            <div className="text-slate-100 font-semibold">{value}</div>
        </div>
    );
}

interface FilePreviewItemProps {
    file: string;
    isHot: boolean;
    pathMode: 'name' | 'path';
    folderDepth: number;
    repoUrlConfig?: RepoUrlConfig;
    onFileSelect?: (path: string) => void;
}

function FilePreviewItem({
    file,
    isHot,
    pathMode,
    folderDepth,
    repoUrlConfig,
    onFileSelect
}: FilePreviewItemProps) {
    return (
        <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${isHot
            ? 'bg-rose-500/10 border border-rose-500/30'
            : 'bg-slate-950 border border-slate-800'
            }`}>
            <div className="flex items-center gap-2 min-w-0">
                {isHot ? (
                    <div className="flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-rose-400 flex-shrink-0 animate-pulse" />
                        <span className="text-[10px] uppercase font-bold text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded">
                            Hot
                        </span>
                    </div>
                ) : (
                    <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                )}
                <span className={`truncate ${isHot ? 'text-rose-200' : 'text-slate-200'}`}>
                    {pathMode === 'name' ? getFileName(file) : file}
                </span>
                {onFileSelect && (
                    <button data-testid="cluster-card-btn-btn-5"
                        onClick={(e) => {
                            e.stopPropagation();
                            onFileSelect(file);
                        }}
                        className="text-slate-500 hover:text-sky-400 flex-shrink-0"
                        title="View file details"
                    >
                        <FileSearch className="w-3.5 h-3.5" />
                    </button>
                )}
                {repoUrlConfig && (
                    <a data-testid="cluster-card-link-link-1"
                        href={buildFileUrl(repoUrlConfig, file)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-sky-400 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                        title="Open in repository"
                    >
                        <ExternalLink className="w-3 h-3" />
                    </a>
                )}
            </div>
            <span className="text-xs text-slate-500 flex-shrink-0 ml-2">
                {getFolderPath(file, folderDepth)}
            </span>
        </div>
    );
}

export default ClusterCard;
