/**
 * Cluster Modal Component (Refactored)
 * 
 * Modal dialog for viewing detailed cluster information.
 * Uses sub-components for different view modes.
 */

import { useMemo, useState, useCallback } from 'react';
import type { ClusterData, RepoUrlConfig, ModalViewMode } from '../types';
import { buildFileTree, formatNumber, formatPercent, countUniqueFolders } from '../utils';
import { Modal, Select, Button, ProgressBar } from '@/components/shared';
import { FileTreeView } from './FileTreeView';
import { FileListView } from './FileListView';
import { FolderSummaryView } from './FolderSummaryView';
import { ClusterInsights } from './ClusterInsights';

export interface ClusterModalProps {
    cluster: ClusterData;
    onClose: () => void;
    onExport: () => void;
    repoUrlConfig?: RepoUrlConfig;
}

const VIEW_OPTIONS = [
    { value: 'tree' as const, label: 'Tree' },
    { value: 'flat' as const, label: 'Flat List' },
    { value: 'summary' as const, label: 'Folder Summary' }
];

export function ClusterModal({ cluster, onClose, onExport, repoUrlConfig }: ClusterModalProps) {
    const [viewMode, setViewMode] = useState<ModalViewMode>('tree');

    const tree = useMemo(
        () => buildFileTree(cluster.files || []),
        [cluster.files]
    );

    const files = cluster.files || [];
    const folderCount = useMemo(() => countUniqueFolders(files, 3), [files]);

    // Get coupling color based on strength
    const getCouplingColor = (coupling: number): 'success' | 'warning' | 'danger' => {
        if (coupling >= 0.8) return 'danger';
        if (coupling >= 0.6) return 'warning';
        return 'success';
    };

    const handleViewModeChange = useCallback((mode: ModalViewMode) => {
        setViewMode(mode);
    }, []);

    const footer = (
        <>
            <Button onClick={onExport} variant="secondary">
                Export to CSV
            </Button>
            <Button onClick={onClose} variant="secondary">
                Close
            </Button>
        </>
    );

    return (
        <Modal
            open
            onClose={onClose}
            title={cluster.name || `Cluster ${cluster.id}`}
            subtitle="Cluster"
            footer={footer}
            size="xl"
        >
            {/* Summary Stats Bar */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Coupling with visual bar */}
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
                    <div className="text-center">
                        <div className="text-lg font-bold text-slate-100">{formatNumber(files.length)}</div>
                        <div className="text-xs text-slate-500">Files</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-bold text-slate-100">{formatNumber(folderCount)}</div>
                        <div className="text-xs text-slate-500">Folders</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-bold text-slate-100">{formatNumber(cluster.total_churn)}</div>
                        <div className="text-xs text-slate-500">Churn</div>
                    </div>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="p-4 border-b border-slate-800 flex flex-wrap items-center gap-4 text-xs">
                <Select
                    value={viewMode}
                    onChange={handleViewModeChange}
                    options={VIEW_OPTIONS}
                    label="View"
                />
            </div>

            {/* Content */}
            <div className="p-4 space-y-6">
                {/* File View */}
                <div className="min-h-[200px]">
                    {viewMode === 'tree' && (
                        <FileTreeView node={tree} repoUrlConfig={repoUrlConfig} />
                    )}
                    {viewMode === 'flat' && (
                        <FileListView files={files} repoUrlConfig={repoUrlConfig} />
                    )}
                    {viewMode === 'summary' && (
                        <FolderSummaryView files={files} />
                    )}
                </div>

                {/* Insights */}
                <ClusterInsights cluster={cluster} repoUrlConfig={repoUrlConfig} />
            </div>
        </Modal>
    );
}

export default ClusterModal;
