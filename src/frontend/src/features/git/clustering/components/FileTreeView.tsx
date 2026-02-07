/**
 * File Tree View Component
 * 
 * Renders a hierarchical tree view of files with navigation links.
 */

import { ExternalLink, FileSearch } from 'lucide-react';
import type { TreeNode, RepoUrlConfig } from '../types';
import { buildFileUrl } from '../utils';

export interface FileTreeViewProps {
    node: TreeNode;
    repoUrlConfig?: RepoUrlConfig;
    onFileSelect?: (path: string) => void;
    depth?: number;
}

export function FileTreeView({ node, repoUrlConfig, onFileSelect, depth = 0 }: FileTreeViewProps) {
    return (
        <div className="space-y-1">
            {node.children.map((child: TreeNode) => (
                <div key={child.path} style={{ marginLeft: depth * 12 }}>
                    <div className="text-sm text-slate-200 font-medium">
                        📁 {child.name}
                    </div>
                    {child.files.map((file: string) => (
                        <FileItem
                            key={file}
                            path={file}
                            displayPath={child.path + '/' + file.split('/').pop()}
                            repoUrlConfig={repoUrlConfig}
                            onFileSelect={onFileSelect}
                        />
                    ))}
                    {child.children.length > 0 && (
                        <FileTreeView
                            node={child}
                            depth={depth + 1}
                            repoUrlConfig={repoUrlConfig}
                            onFileSelect={onFileSelect}
                        />
                    )}
                </div>
            ))}
            {node.files.map((file: string) => (
                <FileItem
                    key={file}
                    path={file}
                    repoUrlConfig={repoUrlConfig}
                    onFileSelect={onFileSelect}
                />
            ))}
        </div>
    );
}

interface FileItemProps {
    path: string;
    displayPath?: string;
    repoUrlConfig?: RepoUrlConfig;
    onFileSelect?: (path: string) => void;
}

function FileItem({ path, displayPath, repoUrlConfig, onFileSelect }: FileItemProps) {
    return (
        <div className="flex items-center gap-1 text-xs text-slate-400 ml-4">
            <span className="flex-1">📄 {displayPath || path}</span>
            {onFileSelect && (
                <button
                    onClick={() => onFileSelect(path)}
                    className="text-slate-500 hover:text-sky-400"
                    title="View file details"
                >
                    <FileSearch className="w-3 h-3" />
                </button>
            )}
            {repoUrlConfig && (
                <a
                    href={buildFileUrl(repoUrlConfig, path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-500 hover:text-sky-400"
                    title="Open in repository"
                >
                    <ExternalLink className="w-3 h-3" />
                </a>
            )}
        </div>
    );
}

export default FileTreeView;
