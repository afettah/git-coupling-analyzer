import { useState, useEffect } from 'react';
import { getFolderTree } from '../api';
import { ChevronRight, ChevronDown, Folder, FileCode } from 'lucide-react';

interface FolderTreeProps {
    repoId: string;
}

export default function FolderTree({ repoId }: FolderTreeProps) {
    const [tree, setTree] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getFolderTree(repoId).then(setTree).finally(() => setLoading(false));
    }, [repoId]);

    if (loading) return <div className="p-8 text-center text-slate-500">Loading tree...</div>;
    if (!tree) return <div className="p-8 text-center text-slate-500">No tree data found</div>;

    return (
        <div className="p-8 max-w-4xl mx-auto w-full">
            <h2 className="text-2xl font-bold mb-6">Repository Structure</h2>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <TreeNode name="/" subtree={tree} depth={0} />
            </div>
        </div>
    );
}

function TreeNode({ name, subtree, depth }: { name: string, subtree: any, depth: number }) {
    const [isOpen, setIsOpen] = useState(depth < 1);
    const isFolder = Object.keys(subtree).length > 0;

    return (
        <div className="select-none">
            <div
                className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-slate-800/50 transition-colors ${depth === 0 ? 'text-sky-400 font-bold' : 'text-slate-300'}`}
                onClick={() => isFolder && setIsOpen(!isOpen)}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
                {isFolder ? (
                    <>
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <Folder size={16} className="text-amber-500/80" fill="currentColor" />
                    </>
                ) : (
                    <FileCode size={16} className="text-slate-500 ml-3.5" />
                )}
                <span className="text-sm">{name}</span>
            </div>

            {isOpen && isFolder && (
                <div>
                    {Object.entries(subtree).map(([childName, childSubtree]) => (
                        <TreeNode
                            key={childName}
                            name={childName}
                            subtree={childSubtree}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
