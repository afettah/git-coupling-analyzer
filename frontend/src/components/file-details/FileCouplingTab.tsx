/**
 * FileCouplingTab Component
 * 
 * Coupling visualization with network graph and file list.
 */

import { useState } from 'react';
import { type CoupledFile } from '../../api';
import { cn } from '@/lib/utils';
import { ArrowRight, HelpCircle, ArrowUpDown } from 'lucide-react';

interface FileCouplingTabProps {
    filePath: string;
    coupling: CoupledFile[];
    onFileSelect?: (path: string) => void;
}

type SortField = 'jaccard' | 'pair_count' | 'path';
type SortDir = 'asc' | 'desc';

// Simple coupling strength indicator
function CouplingBar({ value, max = 1 }: { value: number; max?: number }) {
    const percentage = (value / max) * 100;
    let colorClass = 'bg-purple-500';
    if (value > 0.7) colorClass = 'bg-purple-400';
    else if (value > 0.5) colorClass = 'bg-purple-500';
    else if (value > 0.3) colorClass = 'bg-purple-600';
    else colorClass = 'bg-purple-700';

    return (
        <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                    className={cn('h-full rounded-full transition-all', colorClass)}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <span className="text-xs text-purple-400 font-mono w-12">{(value * 100).toFixed(0)}%</span>
        </div>
    );
}

// Mini network visualization
function MiniNetwork({ files, centerPath }: { files: CoupledFile[]; centerPath: string }) {
    const centerName = centerPath.split('/').pop() || centerPath;
    const topFiles = files.slice(0, 6);

    // Simple radial layout
    const centerX = 150;
    const centerY = 100;
    const radius = 70;

    return (
        <div className="relative h-48 w-full bg-slate-800/20 rounded-lg overflow-hidden">
            <svg width="100%" height="100%" viewBox="0 0 300 200">
                {/* Connection lines */}
                {topFiles.map((file, i) => {
                    const angle = (i / topFiles.length) * 2 * Math.PI - Math.PI / 2;
                    const x = centerX + Math.cos(angle) * radius;
                    const y = centerY + Math.sin(angle) * radius;
                    const opacity = 0.3 + file.jaccard * 0.7;
                    const strokeWidth = 1 + file.jaccard * 2;

                    return (
                        <line
                            key={file.file_id}
                            x1={centerX}
                            y1={centerY}
                            x2={x}
                            y2={y}
                            stroke="#a78bfa"
                            strokeWidth={strokeWidth}
                            opacity={opacity}
                        />
                    );
                })}

                {/* Center node */}
                <circle cx={centerX} cy={centerY} r="24" fill="#0ea5e9" className="drop-shadow-lg" />
                <text
                    x={centerX}
                    y={centerY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-white text-[8px] font-medium"
                >
                    {centerName.slice(0, 12)}
                </text>

                {/* Coupled nodes */}
                {topFiles.map((file, i) => {
                    const angle = (i / topFiles.length) * 2 * Math.PI - Math.PI / 2;
                    const x = centerX + Math.cos(angle) * radius;
                    const y = centerY + Math.sin(angle) * radius;
                    const fileName = file.path.split('/').pop() || file.path;
                    const nodeRadius = 12 + file.jaccard * 8;

                    return (
                        <g key={file.file_id}>
                            <circle cx={x} cy={y} r={nodeRadius} fill="#7c3aed" className="drop-shadow" />
                            <text
                                x={x}
                                y={y + nodeRadius + 10}
                                textAnchor="middle"
                                className="fill-slate-400 text-[7px]"
                            >
                                {fileName.slice(0, 10)}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

// Evidence modal for showing why files are coupled
function CouplingEvidenceModal({
    srcPath,
    dstPath,
    pairCount,
    jaccard,
    onClose
}: {
    srcPath: string;
    dstPath: string;
    pairCount: number;
    jaccard: number;
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 max-w-md w-full" onClick={e => e.stopPropagation()}>
                <h3 className="text-sm font-semibold text-slate-200 mb-4">🔗 Coupling Evidence</h3>

                <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-sky-400">📄</span>
                        <span className="text-slate-300 truncate flex-1">{srcPath.split('/').pop()}</span>
                        <span className="text-slate-500">⟷</span>
                        <span className="text-purple-400">📄</span>
                        <span className="text-slate-300 truncate flex-1">{dstPath.split('/').pop()}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-800/50 rounded-lg">
                        <div>
                            <div className="text-xs text-slate-500">Co-occurrences</div>
                            <div className="text-lg font-bold text-slate-200">{pairCount}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500">Jaccard Score</div>
                            <div className="text-lg font-bold text-purple-400">{(jaccard * 100).toFixed(0)}%</div>
                        </div>
                    </div>

                    <p className="text-xs text-slate-500">
                        These files changed together in <strong>{pairCount}</strong> commits.
                        The Jaccard similarity of {(jaccard * 100).toFixed(0)}% indicates
                        {jaccard > 0.7 ? ' a very strong coupling' : jaccard > 0.5 ? ' a strong coupling' : jaccard > 0.3 ? ' a moderate coupling' : ' a weak coupling'}.
                    </p>
                </div>

                <button
                    onClick={onClose}
                    className="mt-4 w-full px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    );
}

export function FileCouplingTab({ filePath, coupling, onFileSelect }: FileCouplingTabProps) {
    const [sortField, setSortField] = useState<SortField>('jaccard');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [evidenceFile, setEvidenceFile] = useState<CoupledFile | null>(null);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const sortedCoupling = [...coupling].sort((a, b) => {
        let aVal: number | string = 0;
        let bVal: number | string = 0;

        switch (sortField) {
            case 'jaccard':
                aVal = a.jaccard;
                bVal = b.jaccard;
                break;
            case 'pair_count':
                aVal = a.pair_count;
                bVal = b.pair_count;
                break;
            case 'path':
                aVal = a.path;
                bVal = b.path;
                break;
        }

        if (sortDir === 'asc') {
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        }
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    });

    if (coupling.length === 0) {
        return (
            <div className="p-4 text-center text-slate-500">
                <div className="text-4xl mb-2">🔗</div>
                <p>No coupling relationships found</p>
                <p className="text-xs mt-2">This file doesn't frequently change with other files</p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6">
            {/* Mini network visualization */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">🔗 Coupling Network</h3>
                <MiniNetwork files={coupling} centerPath={filePath} />
            </div>

            {/* Coupled files list */}
            <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 overflow-hidden">
                <div className="p-3 border-b border-slate-700/50 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-300">Coupled Files ({coupling.length})</h3>
                </div>

                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-slate-500 text-xs border-b border-slate-700/50">
                            <th
                                className="p-3 font-medium cursor-pointer hover:text-slate-300"
                                onClick={() => handleSort('path')}
                            >
                                <span className="flex items-center gap-1">
                                    File
                                    {sortField === 'path' && <ArrowUpDown size={12} />}
                                </span>
                            </th>
                            <th
                                className="p-3 font-medium cursor-pointer hover:text-slate-300"
                                onClick={() => handleSort('jaccard')}
                            >
                                <span className="flex items-center gap-1">
                                    Coupling
                                    {sortField === 'jaccard' && <ArrowUpDown size={12} />}
                                </span>
                            </th>
                            <th
                                className="p-3 font-medium cursor-pointer hover:text-slate-300"
                                onClick={() => handleSort('pair_count')}
                            >
                                <span className="flex items-center gap-1">
                                    Co-occur
                                    {sortField === 'pair_count' && <ArrowUpDown size={12} />}
                                </span>
                            </th>
                            <th className="p-3 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedCoupling.map((file) => (
                            <tr
                                key={file.file_id}
                                className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                            >
                                <td className="p-3">
                                    <div
                                        className="text-slate-300 truncate max-w-[200px] cursor-pointer hover:text-sky-400"
                                        onClick={() => onFileSelect?.(file.path)}
                                        title={file.path}
                                    >
                                        {file.path}
                                    </div>
                                </td>
                                <td className="p-3">
                                    <CouplingBar value={file.jaccard} />
                                </td>
                                <td className="p-3 text-slate-400">{file.pair_count}</td>
                                <td className="p-3">
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setEvidenceFile(file)}
                                            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                                            title="Why coupled?"
                                        >
                                            <HelpCircle size={14} />
                                        </button>
                                        <button
                                            onClick={() => onFileSelect?.(file.path)}
                                            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                                            title="Go to file"
                                        >
                                            <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Coupling trends/info */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">📊 Coupling Summary</h3>

                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <div className="text-xl font-bold text-purple-400">
                            {coupling.filter(c => c.jaccard > 0.5).length}
                        </div>
                        <div className="text-xs text-slate-500">Strong (&gt;50%)</div>
                    </div>
                    <div>
                        <div className="text-xl font-bold text-purple-500">
                            {coupling.filter(c => c.jaccard > 0.3 && c.jaccard <= 0.5).length}
                        </div>
                        <div className="text-xs text-slate-500">Moderate (30-50%)</div>
                    </div>
                    <div>
                        <div className="text-xl font-bold text-purple-700">
                            {coupling.filter(c => c.jaccard <= 0.3).length}
                        </div>
                        <div className="text-xs text-slate-500">Weak (&lt;30%)</div>
                    </div>
                </div>
            </div>

            {/* Evidence modal */}
            {evidenceFile && (
                <CouplingEvidenceModal
                    srcPath={filePath}
                    dstPath={evidenceFile.path}
                    pairCount={evidenceFile.pair_count}
                    jaccard={evidenceFile.jaccard}
                    onClose={() => setEvidenceFile(null)}
                />
            )}
        </div>
    );
}

export default FileCouplingTab;
