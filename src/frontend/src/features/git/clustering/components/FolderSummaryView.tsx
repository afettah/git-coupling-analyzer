/**
 * Folder Summary View Component
 * 
 * Renders a summary table of files grouped by folder.
 * Collapsible rows to show individual files with navigation links.
 */

import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, FileText, FileSearch } from 'lucide-react';

export interface FolderSummaryViewProps {
    files: string[];
    onFileSelect?: (path: string) => void;
}

interface FolderEntry {
    path: string;
    count: number;
    files: string[];
}

function groupFilesInFolders(files: string[]): FolderEntry[] {
    const folderMap = new Map<string, string[]>();

    files.forEach(file => {
        const parts = file.split('/').filter(Boolean);
        if (parts.length > 1) {
            const folder = parts.slice(0, -1).join('/');
            if (!folderMap.has(folder)) {
                folderMap.set(folder, []);
            }
            folderMap.get(folder)!.push(file);
        }
    });

    return Array.from(folderMap.entries())
        .map(([path, files]) => ({ path, count: files.length, files }))
        .sort((a, b) => b.count - a.count);
}

export function FolderSummaryView({ files, onFileSelect }: FolderSummaryViewProps) {
    const folders = useMemo(() => groupFilesInFolders(files), [files]);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

    const toggleFolder = (path: string) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(path)) {
                newSet.delete(path);
            } else {
                newSet.add(path);
            }
            return newSet;
        });
    };

    if (folders.length === 0) {
        return <div className="text-sm text-slate-500">No folders detected</div>;
    }

    return (
        <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-slate-950 text-xs uppercase text-slate-500">
                    <tr>
                        <th className="px-3 py-2 text-left w-8"></th>
                        <th className="px-3 py-2 text-left">Folder</th>
                        <th className="px-3 py-2 text-left w-20">Files</th>
                    </tr>
                </thead>
                <tbody>
                    {folders.map(folder => {
                        const isExpanded = expandedFolders.has(folder.path);
                        return (
                            <>
                                <tr
                                    key={folder.path}
                                    className="border-t border-slate-800 hover:bg-slate-900/50 cursor-pointer"
                                    onClick={() => toggleFolder(folder.path)}
                                >
                                    <td className="px-3 py-2 text-slate-400">
                                        {isExpanded ? (
                                            <ChevronDown className="w-4 h-4" />
                                        ) : (
                                            <ChevronRight className="w-4 h-4" />
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-slate-200 truncate max-w-md">
                                        📁 {folder.path}
                                    </td>
                                    <td className="px-3 py-2 text-slate-400">{folder.count}</td>
                                </tr>
                                {isExpanded && folder.files.map(file => (
                                    <tr key={file} className="border-t border-slate-800/50 bg-slate-950/50">
                                        <td className="px-3 py-1.5"></td>
                                        <td className="px-3 py-1.5 text-xs text-slate-400 pl-8 flex items-center gap-2">
                                            <FileText className="w-3 h-3 text-slate-500" />
                                            <span className="flex-1">{file.split('/').pop()}</span>
                                            {onFileSelect && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onFileSelect(file);
                                                    }}
                                                    className="text-slate-500 hover:text-sky-400"
                                                    title="View file details"
                                                >
                                                    <FileSearch className="w-3 h-3" />
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-3 py-1.5"></td>
                                    </tr>
                                ))}
                            </>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default FolderSummaryView;
