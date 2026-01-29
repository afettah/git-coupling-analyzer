/**
 * Cluster Modal Component (Refactored)
 * 
 * Modal dialog for viewing detailed cluster information.
 * Uses sub-components for different view modes.
 */

import { useMemo, useState, useCallback } from 'react';
import type { ClusterData, RepoUrlConfig, ModalViewMode } from '../types';
import { buildFileTree, formatNumber, formatPercent } from '../utils';
import { Modal, Select, Button } from '../ui';
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
            {/* Controls Bar */}
            <div className="p-4 border-b border-slate-800 flex flex-wrap items-center gap-4 text-xs">
                <Select
                    value={viewMode}
                    onChange={handleViewModeChange}
                    options={VIEW_OPTIONS}
                    label="View"
                />
                <div className="text-slate-500">
                    Coupling: <span className="text-slate-300">{formatPercent(cluster.avg_coupling)}</span>
                </div>
                <div className="text-slate-500">
                    Files: <span className="text-slate-300">{formatNumber(files.length)}</span>
                </div>
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
