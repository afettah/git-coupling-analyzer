/**
 * Excalidraw View Component (Refactored)
 * 
 * Interactive diagram view for visualizing cluster relationships.
 * Receives pre-filtered clusters from parent.
 * 
 * Features:
 * - View mode: Per Cluster (folders as colors) or Per Folder (clusters as colors)
 * - Folder depth selector for grouping level
 * - Staged settings: changes don't apply until Regenerate is clicked
 * - Unsaved changes warning to prevent accidental loss of edits
 */

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import "@excalidraw/excalidraw/index.css";
// @ts-ignore - Export functions are available at runtime
import { exportToSvg, exportToBlob } from '@excalidraw/excalidraw';
import { RefreshCw, Download, Image, AlertTriangle, FolderTree, Layers } from 'lucide-react';
import type { ClusterData, ClusterEdge } from '../types';
import { sortClustersByRank, downloadBlob } from '../utils';
import { CouplingLegend, Button, Select } from '@/shared';
import { generateExcalidrawElements, type ExcalidrawViewMode, type ExcalidrawGeneratorOptions } from './excalidraw/elementGenerator';

// Set asset path for Excalidraw fonts
if (typeof window !== 'undefined') {
    (window as any).EXCALIDRAW_ASSET_PATH = '/';
}

export interface ExcalidrawViewProps {
    clusters: ClusterData[];
    edges: ClusterEdge[];
}

interface StagedSettings {
    viewMode: ExcalidrawViewMode;
    folderDepth: number;
}

const DEFAULT_SETTINGS: StagedSettings = {
    viewMode: 'per-cluster',
    folderDepth: 2
};

const FOLDER_DEPTH_OPTIONS = [
    { value: '1', label: 'Depth 1 (Top level)' },
    { value: '2', label: 'Depth 2' },
    { value: '3', label: 'Depth 3' },
    { value: '4', label: 'Depth 4' },
    { value: '5', label: 'Depth 5 (Deep)' },
];

const VIEW_MODE_OPTIONS = [
    { value: 'per-cluster', label: 'Per Cluster (folders = colors)' },
    { value: 'per-folder', label: 'Per Folder (clusters = colors)' },
];

export function ExcalidrawView({ clusters, edges }: ExcalidrawViewProps) {
    const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
    const [key, setKey] = useState(0);
    const initializedRef = useRef(false);

    // Applied settings (what's currently rendered)
    const [appliedSettings, setAppliedSettings] = useState<StagedSettings>(DEFAULT_SETTINGS);

    // Staged settings (pending user changes)
    const [stagedSettings, setStagedSettings] = useState<StagedSettings>(DEFAULT_SETTINGS);

    // Track if user has made manual edits in Excalidraw
    const [hasManualEdits, setHasManualEdits] = useState(false);
    const lastElementCountRef = useRef(0);

    // Check if staged settings differ from applied
    const hasSettingsChanges = useMemo(() => {
        return stagedSettings.viewMode !== appliedSettings.viewMode ||
            stagedSettings.folderDepth !== appliedSettings.folderDepth;
    }, [stagedSettings, appliedSettings]);

    // Sort clusters by rank for consistent visualization
    const sortedClusters = useMemo(
        () => sortClustersByRank(clusters),
        [clusters]
    );

    // Generate Excalidraw elements with applied settings
    const elements = useMemo(() => {
        const options: ExcalidrawGeneratorOptions = {
            viewMode: appliedSettings.viewMode,
            folderDepth: appliedSettings.folderDepth
        };
        return generateExcalidrawElements(sortedClusters, edges, options);
    }, [sortedClusters, edges, appliedSettings]);

    // Update scene when API and elements are ready
    useEffect(() => {
        if (excalidrawAPI && elements.length > 0) {
            excalidrawAPI.updateScene({ elements });
            lastElementCountRef.current = elements.length;
            if (!initializedRef.current) {
                initializedRef.current = true;
                setTimeout(() => {
                    excalidrawAPI.scrollToContent(elements, { fitToContent: true });
                }, 50);
            }
        }
    }, [excalidrawAPI, elements]);

    // Track manual edits in Excalidraw
    const handleChange = useCallback(() => {
        if (excalidrawAPI) {
            const currentElements = excalidrawAPI.getSceneElements();
            // If element count changed or elements were modified, user made edits
            if (currentElements.length !== lastElementCountRef.current) {
                setHasManualEdits(true);
            }
        }
    }, [excalidrawAPI]);

    // Warn before leaving with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasManualEdits) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasManualEdits]);

    // Handlers for staged settings
    const handleViewModeChange = useCallback((value: string) => {
        setStagedSettings(prev => ({ ...prev, viewMode: value as ExcalidrawViewMode }));
    }, []);

    const handleFolderDepthChange = useCallback((value: string) => {
        setStagedSettings(prev => ({ ...prev, folderDepth: parseInt(value, 10) }));
    }, []);

    // Apply staged settings and regenerate
    const handleRegenerate = useCallback(() => {
        if (hasManualEdits) {
            const confirmed = window.confirm(
                'You have made manual edits to the diagram. Regenerating will discard these changes. Continue?'
            );
            if (!confirmed) return;
        }

        setAppliedSettings(stagedSettings);
        setHasManualEdits(false);
        initializedRef.current = false;
        setKey(prev => prev + 1);
    }, [stagedSettings, hasManualEdits]);

    const handleExportSvg = useCallback(async () => {
        if (!excalidrawAPI) return;
        try {
            const svg = await exportToSvg({
                elements: excalidrawAPI.getSceneElements(),
                appState: excalidrawAPI.getAppState(),
                files: excalidrawAPI.getFiles()
            });
            const svgString = new XMLSerializer().serializeToString(svg);
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            downloadBlob(blob, 'cluster-diagram.svg');
        } catch (err) {
            console.error('Failed to export SVG:', err);
        }
    }, [excalidrawAPI]);

    const handleExportPng = useCallback(async () => {
        if (!excalidrawAPI) return;
        try {
            const blob = await exportToBlob({
                elements: excalidrawAPI.getSceneElements(),
                appState: excalidrawAPI.getAppState(),
                files: excalidrawAPI.getFiles(),
                mimeType: 'image/png'
            });
            downloadBlob(blob, 'cluster-diagram.png');
        } catch (err) {
            console.error('Failed to export PNG:', err);
        }
    }, [excalidrawAPI]);

    return (
        <div className="space-y-4">
            {/* Header with Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <CouplingLegend />

                    {/* Unsaved changes indicator */}
                    {hasManualEdits && (
                        <div className="flex items-center gap-1.5 text-amber-400 text-xs">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Unsaved edits</span>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* View Mode Selector */}
                    <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-slate-400" />
                        <Select
                            value={stagedSettings.viewMode}
                            onChange={handleViewModeChange}
                            options={VIEW_MODE_OPTIONS}
                            className="w-52"
                        />
                    </div>

                    {/* Folder Depth Selector */}
                    <div className="flex items-center gap-2">
                        <FolderTree className="w-4 h-4 text-slate-400" />
                        <Select
                            value={String(stagedSettings.folderDepth)}
                            onChange={handleFolderDepthChange}
                            options={FOLDER_DEPTH_OPTIONS}
                            className="w-40"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleRegenerate}
                            icon={<RefreshCw className="w-3.5 h-3.5" />}
                            variant={hasSettingsChanges ? 'primary' : 'secondary'}
                        >
                            {hasSettingsChanges ? 'Apply & Regenerate' : 'Regenerate'}
                        </Button>
                        <Button onClick={handleExportSvg} icon={<Download className="w-3.5 h-3.5" />}>
                            SVG
                        </Button>
                        <Button
                            onClick={handleExportPng}
                            variant="primary"
                            icon={<Image className="w-3.5 h-3.5" />}
                        >
                            PNG
                        </Button>
                    </div>
                </div>
            </div>

            {/* Settings change indicator */}
            {hasSettingsChanges && (
                <div className="flex items-center gap-2 px-3 py-2 bg-sky-950/50 border border-sky-800/50 rounded-lg text-xs text-sky-300">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Settings changed. Click "Apply & Regenerate" to update the diagram.</span>
                </div>
            )}

            {/* Canvas */}
            <div className="h-[70vh] min-h-[500px] border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
                <Excalidraw
                    key={key}
                    initialData={{
                        elements,
                        appState: {
                            viewBackgroundColor: '#0f172a',
                            currentItemStrokeColor: '#f1f5f9',
                            currentItemBackgroundColor: '#1e293b',
                            gridSize: null
                        }
                    }}
                    excalidrawAPI={setExcalidrawAPI}
                    onChange={handleChange}
                    theme="dark"
                    UIOptions={{
                        canvasActions: {
                            export: { saveFileToDisk: true }
                        }
                    }}
                />
            </div>

            {/* Instructions */}
            <div className="text-xs text-slate-500 text-center">
                Drag to pan • Scroll to zoom • Click elements to select • Double-click to edit labels • Changes are staged until regenerate
            </div>
        </div>
    );
}

export default ExcalidrawView;
