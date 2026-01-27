import { useState, useEffect } from 'react';
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
    [key: string]: any;
}

export default function FolderTree({ repoId, onFileSelect }: FolderTreeProps) {
    const [tree, setTree] = useState<Record<string, TreeNode>>({});
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

    const renderNode = (name: string, node: TreeNode, path: string, depth: number) => {
        const fullPath = path ? `${path}/${name}` : name;
        const isDir = node.__type === 'dir' || node.__children;
        const isExpanded = expanded.has(fullPath);

        if (isDir) {
            const children = node.__children || {};
            return (
                <div key={fullPath}>
                    <div
                        className="flex items-center gap-1 py-1 px-2 hover:bg-slate-800 rounded cursor-pointer text-sm"
                        style={{ paddingLeft: `${depth * 16 + 8}px` }}
                        onClick={() => toggleExpand(fullPath)}
                    >
                        <span className="text-slate-500">{isExpanded ? '▼' : '▶'}</span>
                        <span className="text-amber-400">📁</span>
                        <span className="text-slate-300">{name}</span>
                    </div>
                    {isExpanded && (
                        <div>
                            {Object.entries(children)
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

        // File node
        return (
            <div
                key={fullPath}
                className="flex items-center gap-1 py-1 px-2 hover:bg-slate-800 rounded cursor-pointer text-sm"
                style={{ paddingLeft: `${depth * 16 + 24}px` }}
                onClick={() => onFileSelect?.(fullPath)}
            >
                <span className="text-sky-400">📄</span>
                <span className="text-slate-400">{name}</span>
                {node.commits && (
                    <span className="text-xs text-slate-600 ml-auto">{node.commits}</span>
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
        <div className="p-4 overflow-auto">
            <h3 className="text-sm font-bold text-slate-400 mb-4">Current Files</h3>
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
        </div>
    );
}
