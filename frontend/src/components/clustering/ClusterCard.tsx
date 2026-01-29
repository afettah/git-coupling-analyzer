import { useMemo, useState } from 'react';
import { Flame, FolderTree, FileText, MoreVertical, ExternalLink } from 'lucide-react';
import { aggregateFolders, formatNumber, formatPercent, getFileName, getFolderPath } from './utils';
import { buildFileUrl, type RepoUrlConfig } from './types';

interface ClusterCardProps {
    cluster: any;
    folderDepth: number;
    onExplore: () => void;
    onExport: () => void;
    repoUrlConfig?: RepoUrlConfig;
}

export default function ClusterCard({ cluster, folderDepth, onExplore, onExport, repoUrlConfig }: ClusterCardProps) {
    const [pathMode, setPathMode] = useState<'name' | 'path'>('name');

    const topFolders = useMemo(() => {
        const files = cluster.files || [];
        return aggregateFolders(files, folderDepth).slice(0, 3);
    }, [cluster.files, folderDepth]);

    const previewFiles = useMemo(() => {
        const hotPaths = new Set((cluster.hot_files || []).map((h: any) => h.path));
        const files = cluster.files || [];
        const sorted = [...files].sort((a, b) => a.localeCompare(b));
        const preferred = sorted.filter((f) => hotPaths.has(f)).concat(sorted.filter((f) => !hotPaths.has(f)));
        return preferred.slice(0, 5);
    }, [cluster.files, cluster.hot_files]);

    return (
        <div className="border border-slate-800 bg-slate-900/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between">
                <div>
                    <div className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                        <FolderTree className="w-4 h-4 text-sky-400" />
                        {cluster.name || `Cluster ${cluster.id}`}
                    </div>
                    <div className="text-xs text-slate-500">{cluster.files?.length || cluster.size || 0} files</div>
                </div>
                <button className="text-slate-500 hover:text-slate-300">
                    <MoreVertical className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
                    <div className="text-slate-500">Coupling</div>
                    <div className="text-slate-100 font-semibold">{formatPercent(cluster.avg_coupling)}</div>
                </div>
                <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
                    <div className="text-slate-500">Folders</div>
                    <div className="text-slate-100 font-semibold">{formatNumber(topFolders.length)}</div>
                </div>
                <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
                    <div className="text-slate-500">Churn</div>
                    <div className="text-slate-100 font-semibold">{formatNumber(cluster.total_churn)}</div>
                </div>
                <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
                    <div className="text-slate-500">Files</div>
                    <div className="text-slate-100 font-semibold">{formatNumber(cluster.files?.length || cluster.size || 0)}</div>
                </div>
            </div>

            <div>
                <div className="text-xs uppercase text-slate-500 mb-2">Top folders</div>
                <div className="space-y-1 text-sm text-slate-200">
                    {topFolders.length === 0 ? (
                        <div className="text-xs text-slate-500">No folders detected</div>
                    ) : (
                        topFolders.map((folder) => (
                            <div key={folder.path} className="flex items-center justify-between">
                                <span>{folder.path}</span>
                                <span className="text-xs text-slate-500">{folder.count} files</span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between mb-2">
                    <div className="text-xs uppercase text-slate-500">Preview files</div>
                    <button
                        onClick={() => setPathMode(pathMode === 'name' ? 'path' : 'name')}
                        className="text-xs text-slate-500 hover:text-slate-300"
                    >
                        {pathMode === 'name' ? 'Show path' : 'Show name'}
                    </button>
                </div>
                <div className="space-y-2 text-sm">
                    {previewFiles.map((file) => {
                        const isHot = (cluster.hot_files || []).some((h: any) => h.path === file);
                        return (
                            <div key={file} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2">
                                    {isHot ? <Flame className="w-4 h-4 text-rose-400" /> : <FileText className="w-4 h-4 text-slate-500" />}
                                    <span className="text-slate-200">
                                        {pathMode === 'name' ? getFileName(file) : file}
                                    </span>
                                    {repoUrlConfig && (
                                        <a
                                            href={buildFileUrl(repoUrlConfig, file)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-slate-500 hover:text-sky-400"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                                <span className="text-xs text-slate-500">{getFolderPath(file, folderDepth)}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <button
                    onClick={onExplore}
                    className="text-sm text-sky-400 hover:text-sky-300"
                >
                    Show all {cluster.files?.length || cluster.size || 0} files
                </button>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onExport}
                        className="px-3 py-1.5 text-xs rounded-lg border border-slate-800 text-slate-300 hover:text-slate-100"
                    >
                        Export
                    </button>
                    <button
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
