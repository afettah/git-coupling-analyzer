import { useMemo, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { buildFileTree, formatNumber, formatPercent, getFileName } from './utils';
import { buildFileUrl, buildCommitUrl, type RepoUrlConfig } from './types';

interface ClusterModalProps {
    cluster: any;
    onClose: () => void;
    onExport: () => void;
    repoUrlConfig?: RepoUrlConfig;
}

export default function ClusterModal({ cluster, onClose, onExport, repoUrlConfig }: ClusterModalProps) {
    const [viewMode, setViewMode] = useState<'tree' | 'flat' | 'summary'>('tree');

    const tree = useMemo(() => buildFileTree(cluster.files || []), [cluster.files]);
    const folders = useMemo(() => {
        const counts = new Map<string, number>();
        (cluster.files || []).forEach((file: string) => {
            const parts = file.split('/');
            if (parts.length > 1) {
                const folder = parts.slice(0, -1).join('/');
                counts.set(folder, (counts.get(folder) || 0) + 1);
            }
        });
        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    }, [cluster.files]);

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                    <div>
                        <div className="text-xs text-slate-500">Cluster</div>
                        <h3 className="text-xl font-semibold text-slate-100">{cluster.name || `Cluster ${cluster.id}`}</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 border-b border-slate-800 flex flex-wrap items-center gap-3 text-xs">
                    <label className="text-slate-500">View</label>
                    <select
                        value={viewMode}
                        onChange={(e) => setViewMode(e.target.value as 'tree' | 'flat' | 'summary')}
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                    >
                        <option value="tree">Tree</option>
                        <option value="flat">Flat List</option>
                        <option value="summary">Folder Summary</option>
                    </select>
                    <div className="text-slate-500">Coupling: {formatPercent(cluster.avg_coupling)}</div>
                    <div className="text-slate-500">Files: {formatNumber(cluster.files?.length || 0)}</div>
                </div>

                <div className="flex-1 overflow-auto p-4 space-y-4">
                    {viewMode === 'tree' && <TreeView node={tree} depth={0} repoUrlConfig={repoUrlConfig} />}
                    {viewMode === 'flat' && (
                        <div className="space-y-2">
                            {(cluster.files || []).map((file: string) => (
                                <div key={file} className="flex items-center gap-2 text-sm text-slate-200 bg-slate-950 border border-slate-800 rounded px-3 py-2">
                                    <span className="flex-1">{file}</span>
                                    {repoUrlConfig && (
                                        <a
                                            href={buildFileUrl(repoUrlConfig, file)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-slate-500 hover:text-sky-400"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    {viewMode === 'summary' && (
                        <div className="border border-slate-800 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-950 text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Folder</th>
                                        <th className="px-3 py-2 text-left">Files</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {folders.map(([path, count]) => (
                                        <tr key={path} className="border-t border-slate-800">
                                            <td className="px-3 py-2 text-slate-200">{path}</td>
                                            <td className="px-3 py-2 text-slate-400">{count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="border-t border-slate-800 pt-4">
                        <h4 className="text-sm font-semibold text-slate-200 mb-2">Cluster Insights</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400">
                            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                                <div className="text-slate-500">Top authors</div>
                                {(cluster.common_authors || []).map((author: any) => (
                                    <div key={author.email} className="text-slate-200">
                                        {author.name} • {formatNumber(author.commit_count)} commits
                                    </div>
                                ))}
                                {(cluster.common_authors || []).length === 0 && <div>No author data</div>}
                            </div>
                            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                                <div className="text-slate-500">Top commits</div>
                                {(cluster.top_commits || []).map((commit: any) => (
                                    <div key={commit.oid} className="flex items-center gap-1 text-slate-200">
                                        <span>{getFileName(commit.message || 'Commit')} • {commit.file_count} files</span>
                                        {repoUrlConfig && (
                                            <a
                                                href={buildCommitUrl(repoUrlConfig, commit.oid)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-slate-500 hover:text-sky-400"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}
                                    </div>
                                ))}
                                {(cluster.top_commits || []).length === 0 && <div>No commit data</div>}
                            </div>
                            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                                <div className="text-slate-500">Hot files</div>
                                {(cluster.hot_files || []).map((file: any) => (
                                    <div key={file.path} className="flex items-center gap-1 text-slate-200">
                                        <span>{getFileName(file.path)} • {formatNumber(file.churn)} churn</span>
                                        {repoUrlConfig && (
                                            <a
                                                href={buildFileUrl(repoUrlConfig, file.path)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-slate-500 hover:text-sky-400"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}
                                    </div>
                                ))}
                                {(cluster.hot_files || []).length === 0 && <div>No churn data</div>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-800 flex justify-end gap-2">
                    <button onClick={onExport} className="px-3 py-2 text-xs rounded-lg border border-slate-700 text-slate-300 hover:text-slate-100">
                        Export to CSV
                    </button>
                    <button onClick={onClose} className="px-3 py-2 text-xs rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

function TreeView({ node, depth, repoUrlConfig }: { node: any; depth: number; repoUrlConfig?: RepoUrlConfig }) {
    return (
        <div className="space-y-2">
            {node.children.map((child: any) => (
                <div key={child.path} style={{ marginLeft: depth * 12 }}>
                    <div className="text-sm text-slate-200 font-medium">📁 {child.name}</div>
                    {child.files.map((file: string) => (
                        <div key={file} className="flex items-center gap-1 text-xs text-slate-400 ml-4">
                            <span>📄 {file}</span>
                            {repoUrlConfig && (
                                <a
                                    href={buildFileUrl(repoUrlConfig, child.path + '/' + file)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-slate-500 hover:text-sky-400"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    ))}
                    {child.children.length > 0 && <TreeView node={child} depth={depth + 1} repoUrlConfig={repoUrlConfig} />}
                </div>
            ))}
            {node.files.map((file: string) => (
                <div key={file} className="flex items-center gap-1 text-xs text-slate-400 ml-4">
                    <span>📄 {file}</span>
                    {repoUrlConfig && (
                        <a
                            href={buildFileUrl(repoUrlConfig, file)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 hover:text-sky-400"
                        >
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </div>
            ))}
        </div>
    );
}
