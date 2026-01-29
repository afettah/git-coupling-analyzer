/**
 * Folder Summary View Component
 * 
 * Renders a summary table of files grouped by folder.
 */

import { useMemo } from 'react';
import { countFilesPerFolder } from '../utils';

export interface FolderSummaryViewProps {
    files: string[];
}

export function FolderSummaryView({ files }: FolderSummaryViewProps) {
    const folders = useMemo(() => {
        const counts = countFilesPerFolder(files);
        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1]);
    }, [files]);

    if (folders.length === 0) {
        return <div className="text-sm text-slate-500">No folders detected</div>;
    }

    return (
        <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-slate-950 text-xs uppercase text-slate-500">
                    <tr>
                        <th className="px-3 py-2 text-left">Folder</th>
                        <th className="px-3 py-2 text-left w-20">Files</th>
                    </tr>
                </thead>
                <tbody>
                    {folders.map(([path, count]) => (
                        <tr key={path} className="border-t border-slate-800">
                            <td className="px-3 py-2 text-slate-200 truncate max-w-md">
                                {path}
                            </td>
                            <td className="px-3 py-2 text-slate-400">{count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default FolderSummaryView;
