/**
 * Excalidraw View Component (Refactored)
 * 
 * Interactive diagram view for visualizing cluster relationships.
 */

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
// @ts-ignore - Export functions are available at runtime
import { exportToSvg, exportToBlob } from '@excalidraw/excalidraw';
import { RefreshCw, Download, Image } from 'lucide-react';
import type { ClusterData, ClusterEdge, ClusterFilterState } from '../types';
import { enrichClustersWithNames, sortClustersByRank, downloadBlob } from '../utils';
import { DEFAULT_FILTER_STATE } from '../constants';
import { ClusterFilters, CouplingLegend, Button } from '../ui';
import { generateExcalidrawElements } from './excalidraw/elementGenerator';

// Set asset path for Excalidraw fonts
if (typeof window !== 'undefined') {
    (window as any).EXCALIDRAW_ASSET_PATH = '/';
}

export interface ExcalidrawViewProps {
    clusters: ClusterData[];
    edges: ClusterEdge[];
}

export function ExcalidrawView({ clusters, edges }: ExcalidrawViewProps) {
    const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
    const [key, setKey] = useState(0);
    const initializedRef = useRef(false);

    // Filter state
    const maxFileCount = useMemo(
        () => Math.max(...clusters.map(c => c.files?.length || c.size || 0), 100),
        [clusters]
    );

    const [filters, setFilters] = useState<ClusterFilterState>({
        ...DEFAULT_FILTER_STATE,
        fileRange: [0, maxFileCount]
    });

    // Process clusters: add names, filter, and sort
    const processedClusters = useMemo(() => {
        const withNames = enrichClustersWithNames(clusters);
        const filtered = withNames.filter(cluster => {
            const fileCount = cluster.files?.length || cluster.size || 0;
            const coupling = cluster.avg_coupling || 0;
            const name = cluster.name || '';

            return (
                fileCount >= filters.minClusterSize &&
                coupling >= filters.couplingRange[0] &&
                coupling <= filters.couplingRange[1] &&
                fileCount >= filters.fileRange[0] &&
                fileCount <= filters.fileRange[1] &&
                (!filters.search || name.toLowerCase().includes(filters.search.toLowerCase()))
            );
        });
        return sortClustersByRank(filtered);
    }, [clusters, filters]);

    // Filter edges to visible clusters
    const filteredEdges = useMemo(() => {
        const visibleIds = new Set(processedClusters.map(c => c.id));
        return edges.filter(e => visibleIds.has(e.from_cluster) && visibleIds.has(e.to_cluster));
    }, [edges, processedClusters]);

    // Generate Excalidraw elements
    const elements = useMemo(
        () => generateExcalidrawElements(processedClusters, filteredEdges),
        [processedClusters, filteredEdges]
    );

    // Update scene when API and elements are ready
    useEffect(() => {
        if (excalidrawAPI && elements.length > 0) {
            excalidrawAPI.updateScene({ elements });
            if (!initializedRef.current) {
                initializedRef.current = true;
                setTimeout(() => {
                    excalidrawAPI.scrollToContent(elements, { fitToContent: true });
                }, 50);
            }
        }
    }, [excalidrawAPI, elements]);

    // Handlers
    const handleRegenerate = useCallback(() => {
        initializedRef.current = false;
        setKey(prev => prev + 1);
    }, []);

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
            {/* Header */}
            <div className="flex items-center justify-between">
                <CouplingLegend />
                <div className="flex items-center gap-2">
                    <Button onClick={handleRegenerate} icon={<RefreshCw className="w-3.5 h-3.5" />}>
                        Regenerate
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

            {/* Filters */}
            <ClusterFilters
                filters={filters}
                onFiltersChange={setFilters}
                maxFileCount={maxFileCount}
                filteredCount={processedClusters.length}
                totalCount={clusters.length}
            />

            {/* Canvas */}
            <div className="h-[70vh] border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
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
                Drag to pan • Scroll to zoom • Click clusters to select • Double-click to edit labels
            </div>
        </div>
    );
}

export default ExcalidrawView;
