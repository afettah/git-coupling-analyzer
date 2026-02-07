/**
 * File List View Component
 * 
 * Renders a flat list of files with external links and internal navigation.
 */

import { ExternalLink, FileSearch } from 'lucide-react';
import type { RepoUrlConfig } from '../types';
import { buildFileUrl } from '../utils';

export interface FileListViewProps {
    files: string[];
    repoUrlConfig?: RepoUrlConfig;
    onFileSelect?: (path: string) => void;
}

export function FileListView({ files, repoUrlConfig, onFileSelect }: FileListViewProps) {
    return (
        <div className="space-y-2">
            {files.map((file) => (
                <div
                    key={file}
                    className="flex items-center gap-2 text-sm text-slate-200 bg-slate-950 border border-slate-800 rounded px-3 py-2"
                >
                    <span className="flex-1 truncate">{file}</span>
                    {onFileSelect && (
                        <button
                            onClick={() => onFileSelect(file)}
                            className="text-slate-500 hover:text-sky-400 flex-shrink-0"
                            title="View file details"
                        >
                            <FileSearch className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {repoUrlConfig && (
                        <a
                            href={buildFileUrl(repoUrlConfig, file)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 hover:text-sky-400 flex-shrink-0"
                            title="Open in repository"
                        >
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </div>
            ))}
        </div>
    );
}

export default FileListView;
