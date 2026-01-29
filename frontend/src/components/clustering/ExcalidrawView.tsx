import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
// @ts-ignore - Export functions are available at runtime from @excalidraw/utils/export
import { exportToSvg, exportToBlob } from '@excalidraw/excalidraw';
import type { ClusterEdge } from './types';
import { RefreshCw, Download, Image } from 'lucide-react';
import { generateClusterName, calculateClusterRank } from './utils';
import ClusterFilters, { type ClusterFilterState } from './ClusterFilters';

// Set asset path for Excalidraw fonts and assets
if (typeof window !== 'undefined') {
    (window as any).EXCALIDRAW_ASSET_PATH = '/';
}

interface ExcalidrawViewProps {
    clusters: any[];
    edges: ClusterEdge[];
}

// Color palette for clusters based on coupling strength
const getCouplingColor = (coupling: number): string => {
    if (coupling >= 0.8) return '#ef4444'; // Red - very high coupling
    if (coupling >= 0.6) return '#f97316'; // Orange - high coupling
    if (coupling >= 0.4) return '#facc15'; // Yellow - medium coupling
    if (coupling >= 0.2) return '#22c55e'; // Green - low coupling
    return '#38bdf8'; // Blue - very low coupling
};

const generateElements = (clusters: any[], edges: ClusterEdge[]) => {
    const cols = Math.max(1, Math.ceil(Math.sqrt(clusters.length)));
    const nodeMap = new Map<number, { x: number; y: number }>();
    const boxWidth = 400;
    const boxHeight = 300;
    const gapX = 120;
    const gapY = 100;

    // File grid settings
    const fileBoxWidth = 50;
    const fileBoxHeight = 30;
    const fileGap = 8;
    const filesPerRow = 5;
    const maxFilesPerCluster = 20;
    const filesStartY = 50;
    const filesStartX = 16;

    const output: any[] = [];

    clusters.forEach((cluster, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = col * (boxWidth + gapX);
        const y = row * (boxHeight + gapY);
        const coupling = cluster.avg_coupling || 0;
        nodeMap.set(cluster.id, { x: x + boxWidth / 2, y: y + boxHeight / 2 });

        // Main cluster rectangle
        output.push({
            id: `cluster-${cluster.id}`,
            type: 'rectangle',
            x,
            y,
            width: boxWidth,
            height: boxHeight,
            angle: 0,
            strokeColor: getCouplingColor(coupling),
            backgroundColor: '#1e293b',
            fillStyle: 'solid',
            strokeWidth: 2,
            roughness: 0,
            opacity: 100,
            groupIds: [],
            frameId: null,
            roundness: { type: 3 },
            version: 1,
            versionNonce: Math.random() * 1000000 | 0,
            isDeleted: false,
            boundElements: null,
            updated: Date.now(),
            link: null,
            locked: false,
            seed: Math.random() * 1000000 | 0
        });

        // Cluster name text
        const clusterName = cluster.name || `Cluster ${cluster.id}`;
        output.push({
            id: `name-${cluster.id}`,
            type: 'text',
            x: x + 16,
            y: y + 16,
            width: boxWidth - 32,
            height: 24,
            angle: 0,
            strokeColor: '#f1f5f9',
            backgroundColor: 'transparent',
            fillStyle: 'solid',
            strokeWidth: 1,
            roughness: 0,
            opacity: 100,
            groupIds: [],
            frameId: null,
            roundness: null,
            version: 1,
            versionNonce: Math.random() * 1000000 | 0,
            isDeleted: false,
            boundElements: null,
            updated: Date.now(),
            link: null,
            locked: false,
            text: clusterName.length > 30 ? clusterName.slice(0, 28) + '...' : clusterName,
            fontSize: 18,
            fontFamily: 1,
            textAlign: 'left',
            verticalAlign: 'top',
            containerId: null,
            originalText: clusterName
        });

        // Draw file rectangles inside cluster
        const files = cluster.files || [];
        const displayFiles = files.slice(0, maxFilesPerCluster);

        displayFiles.forEach((file: any, fileIndex: number) => {
            const fileRow = Math.floor(fileIndex / filesPerRow);
            const fileCol = fileIndex % filesPerRow;
            const fileX = x + filesStartX + fileCol * (fileBoxWidth + fileGap);
            const fileY = y + filesStartY + fileRow * (fileBoxHeight + fileGap);

            // Get file coupling or churn for color
            const fileCoupling = file.coupling || file.churn || coupling;
            const fileColor = getCouplingColor(fileCoupling);

            output.push({
                id: `file-${cluster.id}-${fileIndex}`,
                type: 'rectangle',
                x: fileX,
                y: fileY,
                width: fileBoxWidth,
                height: fileBoxHeight,
                angle: 0,
                strokeColor: fileColor,
                backgroundColor: fileColor,
                fillStyle: 'solid',
                strokeWidth: 1,
                roughness: 0,
                opacity: 70,
                groupIds: [],
                frameId: null,
                roundness: { type: 3 },
                version: 1,
                versionNonce: Math.random() * 1000000 | 0,
                isDeleted: false,
                boundElements: null,
                updated: Date.now(),
                link: null,
                locked: false,
                seed: Math.random() * 1000000 | 0
            });
        });

        // Stats text at bottom
        const fileCount = cluster.files?.length || cluster.size || 0;
        const couplingPct = Math.round(coupling * 100);
        output.push({
            id: `stats-${cluster.id}`,
            type: 'text',
            x: x + 16,
            y: y + boxHeight - 30,
            width: boxWidth - 32,
            height: 24,
            angle: 0,
            strokeColor: '#94a3b8',
            backgroundColor: 'transparent',
            fillStyle: 'solid',
            strokeWidth: 1,
            roughness: 0,
            opacity: 100,
            groupIds: [],
            frameId: null,
            roundness: null,
            version: 1,
            versionNonce: Math.random() * 1000000 | 0,
            isDeleted: false,
            boundElements: null,
            updated: Date.now(),
            link: null,
            locked: false,
            text: `${fileCount} files • ${couplingPct}% coupling`,
            fontSize: 14,
            fontFamily: 1,
            textAlign: 'left',
            verticalAlign: 'top',
            containerId: null,
            originalText: `${fileCount} files • ${couplingPct}% coupling`
        });
    });

    // Create edges between clusters
    edges.forEach((edge, index) => {
        const from = nodeMap.get(edge.from_cluster);
        const to = nodeMap.get(edge.to_cluster);
        if (!from || !to) return;

        const strength = edge.coupling_strength || 0;
        const strokeWidth = Math.max(1, Math.round(strength * 8));

        output.push({
            id: `edge-${index}`,
            type: 'arrow',
            x: from.x,
            y: from.y,
            width: to.x - from.x,
            height: to.y - from.y,
            angle: 0,
            strokeColor: strength > 0.5 ? '#f97316' : '#64748b',
            backgroundColor: 'transparent',
            fillStyle: 'solid',
            strokeWidth,
            roughness: 0,
            opacity: Math.min(100, Math.round(strength * 100 + 30)),
            groupIds: [],
            frameId: null,
            roundness: { type: 2 },
            version: 1,
            versionNonce: Math.random() * 1000000 | 0,
            isDeleted: false,
            boundElements: null,
            updated: Date.now(),
            link: null,
            locked: false,
            points: [
                [0, 0],
                [to.x - from.x, to.y - from.y]
            ],
            lastCommittedPoint: null,
            startBinding: null,
            endBinding: null,
            startArrowhead: null,
            endArrowhead: 'arrow'
        });

        // Add edge label with coupling percentage
        if (strength > 0.2) {
            const midX = from.x + (to.x - from.x) / 2 - 20;
            const midY = from.y + (to.y - from.y) / 2 - 10;
            output.push({
                id: `edge-label-${index}`,
                type: 'text',
                x: midX,
                y: midY,
                width: 40,
                height: 20,
                angle: 0,
                strokeColor: '#94a3b8',
                backgroundColor: '#0f172a',
                fillStyle: 'solid',
                strokeWidth: 1,
                roughness: 0,
                opacity: 80,
                groupIds: [],
                frameId: null,
                roundness: null,
                version: 1,
                versionNonce: Math.random() * 1000000 | 0,
                isDeleted: false,
                boundElements: null,
                updated: Date.now(),
                link: null,
                locked: false,
                text: `${Math.round(strength * 100)}%`,
                fontSize: 12,
                fontFamily: 1,
                textAlign: 'center',
                verticalAlign: 'middle',
                containerId: null,
                originalText: `${Math.round(strength * 100)}%`
            });
        }
    });

    return output;
};

export default function ExcalidrawView({ clusters, edges }: ExcalidrawViewProps) {
    const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
    const [key, setKey] = useState(0);
    const initializedRef = useRef(false);

    // Filter state
    const maxFileCount = useMemo(() => {
        return Math.max(...clusters.map(c => c.files?.length || c.size || 0), 100);
    }, [clusters]);

    const [filters, setFilters] = useState<ClusterFilterState>({
        couplingRange: [0.05, 1],
        fileRange: [0, maxFileCount],
        minClusterSize: 2,  // Default: exclude single-file clusters
        search: ''
    });

    // Add smart names to clusters, filter by minimum size, and sort by rank
    const clustersWithNames = useMemo(() => {
        return clusters
            .filter(cluster => {
                const fileCount = cluster.files?.length || cluster.size || 0;
                return fileCount >= filters.minClusterSize;
            })
            .map(cluster => ({
                ...cluster,
                name: cluster.name || generateClusterName(cluster.files || [])
            }))
            .sort((a, b) => calculateClusterRank(b) - calculateClusterRank(a)); // Sort by rank descending
    }, [clusters, filters.minClusterSize]);

    // Filter clusters
    const filteredClusters = useMemo(() => {
        return clustersWithNames.filter(cluster => {
            const coupling = cluster.avg_coupling || 0;
            const fileCount = cluster.files?.length || cluster.size || 0;
            const name = cluster.name || '';
            const filesMatch = cluster.files?.some((f: any) =>
                (f.path || f.name || '').toLowerCase().includes(filters.search.toLowerCase())
            ) || false;

            const inCouplingRange = coupling >= filters.couplingRange[0] && coupling <= filters.couplingRange[1];
            const inFileRange = fileCount >= filters.fileRange[0] && fileCount <= filters.fileRange[1];
            const matchesSearch = filters.search === '' ||
                name.toLowerCase().includes(filters.search.toLowerCase()) ||
                filesMatch;

            return inCouplingRange && inFileRange && matchesSearch;
        });
    }, [clustersWithNames, filters]);

    // Filter edges to only include those between visible clusters
    const filteredEdges = useMemo(() => {
        const visibleClusterIds = new Set(filteredClusters.map(c => c.id));
        return edges.filter(edge =>
            visibleClusterIds.has(edge.from_cluster) && visibleClusterIds.has(edge.to_cluster)
        );
    }, [edges, filteredClusters]);

    const elements = useMemo(() => generateElements(filteredClusters, filteredEdges), [filteredClusters, filteredEdges]);

    // Update scene when API is ready and elements are available
    useEffect(() => {
        if (excalidrawAPI && elements.length > 0) {
            // Always update the scene when elements change
            excalidrawAPI.updateScene({ elements });
            if (!initializedRef.current) {
                initializedRef.current = true;
                // Scroll to content only on first initialization
                setTimeout(() => {
                    excalidrawAPI.scrollToContent(elements, { fitToContent: true });
                }, 50);
            }
        }
    }, [excalidrawAPI, elements]);

    const handleRegenerate = useCallback(() => {
        initializedRef.current = false;
        setKey(prev => prev + 1);
    }, []);

    const handleExportSvg = useCallback(async () => {
        if (!excalidrawAPI) return;
        try {
            const svg = await (exportToSvg as any)({
                elements: excalidrawAPI.getSceneElements(),
                appState: excalidrawAPI.getAppState(),
                files: excalidrawAPI.getFiles()
            });
            const svgString = new XMLSerializer().serializeToString(svg);
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'cluster-diagram.svg';
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to export SVG:', err);
        }
    }, [excalidrawAPI]);

    const handleExportPng = useCallback(async () => {
        if (!excalidrawAPI) return;
        try {
            const blob = await (exportToBlob as any)({
                elements: excalidrawAPI.getSceneElements(),
                appState: excalidrawAPI.getAppState(),
                files: excalidrawAPI.getFiles(),
                mimeType: 'image/png'
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'cluster-diagram.png';
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to export PNG:', err);
        }
    }, [excalidrawAPI]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
                    <span>High coupling (80%+)</span>
                    <span className="inline-block w-3 h-3 rounded-full bg-orange-500 ml-3"></span>
                    <span>Medium (60-80%)</span>
                    <span className="inline-block w-3 h-3 rounded-full bg-yellow-400 ml-3"></span>
                    <span>Low (40-60%)</span>
                    <span className="inline-block w-3 h-3 rounded-full bg-green-500 ml-3"></span>
                    <span>Very low (&lt;40%)</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRegenerate}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Regenerate
                    </button>
                    <button
                        onClick={handleExportSvg}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
                    >
                        <Download className="w-3.5 h-3.5" />
                        SVG
                    </button>
                    <button
                        onClick={handleExportPng}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors"
                    >
                        <Image className="w-3.5 h-3.5" />
                        PNG
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <ClusterFilters
                filters={filters}
                onFiltersChange={setFilters}
                maxFileCount={maxFileCount}
                filteredCount={filteredClusters.length}
                totalCount={clustersWithNames.length}
            />

            <div className="h-[70vh] border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
                <Excalidraw
                    key={key}
                    initialData={{
                        elements: elements,
                        appState: {
                            viewBackgroundColor: '#0f172a',
                            currentItemStrokeColor: '#f1f5f9',
                            currentItemBackgroundColor: '#1e293b',
                            gridSize: null
                        }
                    }}
                    excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
                    theme="dark"
                    UIOptions={{
                        canvasActions: {
                            export: { saveFileToDisk: true }
                        }
                    }}
                />
            </div>

            <div className="text-xs text-slate-500 text-center">
                Drag to pan • Scroll to zoom • Click clusters to select • Double-click to edit labels
            </div>
        </div>
    );
}
