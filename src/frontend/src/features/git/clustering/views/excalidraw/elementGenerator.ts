/**
 * Excalidraw Element Generator
 * 
 * Generates Excalidraw elements from cluster data with multiple view modes:
 * - Per Cluster: Files grouped by cluster, colored by folder
 * - Per Folder: Files grouped by folder, colored by cluster
 */

import type { ClusterData, ClusterEdge } from '../../types';
import { getCouplingColor, EXCALIDRAW_CONFIG, CLUSTER_PALETTE } from '../../constants';

const {
    boxWidth,
    boxHeight,
    gapX,
    gapY,
    fileBoxHeight,
    fileGap,
    filesStartY,
    filesStartX
} = EXCALIDRAW_CONFIG;

// View mode types
export type ExcalidrawViewMode = 'per-cluster' | 'per-folder';

export interface ExcalidrawGeneratorOptions {
    viewMode: ExcalidrawViewMode;
    folderDepth: number;
}

const DEFAULT_OPTIONS: ExcalidrawGeneratorOptions = {
    viewMode: 'per-cluster',
    folderDepth: 2
};

interface ExcalidrawElement {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    angle: number;
    strokeColor: string;
    backgroundColor: string;
    fillStyle: string;
    strokeWidth: number;
    roughness: number;
    opacity: number;
    groupIds: string[];
    frameId: null;
    roundness: { type: number } | null;
    version: number;
    versionNonce: number;
    isDeleted: boolean;
    boundElements: null;
    updated: number;
    link: null;
    locked: boolean;
    seed?: number;
    text?: string;
    fontSize?: number;
    fontFamily?: number;
    textAlign?: string;
    verticalAlign?: string;
    containerId?: null;
    originalText?: string;
    points?: number[][];
    lastCommittedPoint?: null;
    startBinding?: null;
    endBinding?: null;
    startArrowhead?: null;
    endArrowhead?: string;
}

function createRectangle(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    strokeColor: string,
    backgroundColor: string,
    opacity: number = 100
): ExcalidrawElement {
    return {
        id,
        type: 'rectangle',
        x,
        y,
        width,
        height,
        angle: 0,
        strokeColor,
        backgroundColor,
        fillStyle: 'solid',
        strokeWidth: 2,
        roughness: 0,
        opacity,
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
    };
}

function createText(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    color: string,
    fontSize: number = 18
): ExcalidrawElement {
    return {
        id,
        type: 'text',
        x,
        y,
        width,
        height,
        angle: 0,
        strokeColor: color,
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
        text,
        fontSize,
        fontFamily: 1,
        textAlign: 'left',
        verticalAlign: 'top',
        containerId: null,
        originalText: text
    };
}

function createArrow(
    id: string,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    strength: number
): ExcalidrawElement {
    const strokeWidth = Math.max(1, Math.round(strength * 8));
    return {
        id,
        type: 'arrow',
        x: fromX,
        y: fromY,
        width: toX - fromX,
        height: toY - fromY,
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
            [toX - fromX, toY - fromY]
        ],
        lastCommittedPoint: null,
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: 'arrow'
    };
}

/**
 * Extract folder path at given depth
 */
function getFolderAtDepth(filePath: string, depth: number): string {
    const parts = filePath.split('/');
    // Take first `depth` parts (folder segments)
    const folderParts = parts.slice(0, Math.min(depth, parts.length - 1));
    return folderParts.join('/') || '/';
}

/**
 * Get file name from path
 */
function getFileName(filePath: string): string {
    const parts = filePath.split('/');
    return parts[parts.length - 1] || filePath;
}

/**
 * Truncate text to fit width
 */
function truncateText(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars - 2) + '..';
}

/**
 * Get a color for a folder based on its hash
 */
function getFolderColor(folderPath: string): string {
    let hash = 0;
    for (let i = 0; i < folderPath.length; i++) {
        hash = ((hash << 5) - hash) + folderPath.charCodeAt(i);
        hash = hash & hash;
    }
    return CLUSTER_PALETTE[Math.abs(hash) % CLUSTER_PALETTE.length];
}

/**
 * Get a color for a cluster
 */
function getClusterColor(clusterId: number): string {
    return CLUSTER_PALETTE[clusterId % CLUSTER_PALETTE.length];
}

interface FileItem {
    path: string;
    name: string;
    folder: string;
    clusterId: number;
    clusterName: string;
}

interface GroupBox {
    id: string;
    name: string;
    files: FileItem[];
    coupling: number;
    borderColor: string;
}

/**
 * Generate elements for Per-Cluster view (files grouped by cluster, colored by folder)
 */
function generatePerClusterView(
    clusters: ClusterData[],
    edges: ClusterEdge[],
    folderDepth: number
): ExcalidrawElement[] {
    const cols = Math.max(1, Math.ceil(Math.sqrt(clusters.length)));
    const nodeMap = new Map<number, { x: number; y: number; height: number }>();
    const elements: ExcalidrawElement[] = [];

    // Calculate dynamic box heights based on file count
    const positions: { x: number; y: number; height: number }[] = [];
    const rowHeights: number[] = [];
    let currentRow = 0;
    let maxRowHeight = 0;

    clusters.forEach((cluster, index) => {
        const col = index % cols;
        if (col === 0 && index > 0) {
            rowHeights.push(maxRowHeight);
            maxRowHeight = 0;
            currentRow++;
        }

        const files = cluster.files || [];
        const fileCount = Math.min(files.length, 15); // Max 15 files displayed
        const dynamicHeight = Math.max(boxHeight, filesStartY + 50 + fileCount * (fileBoxHeight + fileGap + 16));
        maxRowHeight = Math.max(maxRowHeight, dynamicHeight);

        positions.push({ x: 0, y: 0, height: dynamicHeight });
    });
    rowHeights.push(maxRowHeight);

    // Calculate actual positions with variable heights
    let currentY = 0;
    currentRow = 0;

    clusters.forEach((_, index) => {
        const col = index % cols;
        if (col === 0 && index > 0) {
            currentY += rowHeights[currentRow] + gapY;
            currentRow++;
        }

        const x = col * (boxWidth + gapX);
        const y = currentY;
        const height = positions[index].height;
        positions[index] = { x, y, height };
    });

    // Generate cluster boxes
    clusters.forEach((cluster, index) => {
        const { x, y, height } = positions[index];
        const coupling = cluster.avg_coupling || 0;

        nodeMap.set(cluster.id, { x: x + boxWidth / 2, y: y + height / 2, height });

        // Main cluster rectangle
        elements.push(createRectangle(
            `cluster-${cluster.id}`,
            x, y,
            boxWidth, height,
            getCouplingColor(coupling),
            '#1e293b'
        ));

        // Cluster name
        const clusterName = cluster.name || `Cluster ${cluster.id}`;
        const displayName = truncateText(clusterName, 35);
        elements.push(createText(
            `name-${cluster.id}`,
            x + 16, y + 16,
            boxWidth - 32, 24,
            displayName,
            '#f1f5f9',
            18
        ));

        // File items with names and folder colors
        const files = cluster.files || [];
        const displayFiles = files.slice(0, 15);
        const fileWidth = boxWidth - 32;

        displayFiles.forEach((filePath: string, fileIndex: number) => {
            const fileName = getFileName(filePath);
            const folder = getFolderAtDepth(filePath, folderDepth);
            const folderColor = getFolderColor(folder);

            const fileX = x + filesStartX;
            const fileY = y + filesStartY + fileIndex * (fileBoxHeight + fileGap + 16);

            // File rectangle with folder color
            elements.push(createRectangle(
                `file-${cluster.id}-${fileIndex}`,
                fileX, fileY,
                fileWidth, fileBoxHeight + 14,
                folderColor, folderColor,
                50
            ));

            // File name
            const displayFileName = truncateText(fileName, 40);
            elements.push(createText(
                `filename-${cluster.id}-${fileIndex}`,
                fileX + 8, fileY + 5,
                fileWidth - 16, 16,
                displayFileName,
                '#f1f5f9',
                11
            ));

            // Folder path (smaller text)
            const displayFolder = truncateText(folder, 45);
            elements.push(createText(
                `folder-${cluster.id}-${fileIndex}`,
                fileX + 8, fileY + 20,
                fileWidth - 16, 14,
                displayFolder,
                '#94a3b8',
                9
            ));
        });

        // Show file count if truncated
        if (files.length > 15) {
            elements.push(createText(
                `more-${cluster.id}`,
                x + 16, y + filesStartY + 15 * (fileBoxHeight + fileGap + 16) + 5,
                boxWidth - 32, 16,
                `... and ${files.length - 15} more files`,
                '#64748b',
                10
            ));
        }

        // Stats text at bottom
        const fileCount = files.length || cluster.size || 0;
        const couplingPct = Math.round(coupling * 100);
        elements.push(createText(
            `stats-${cluster.id}`,
            x + 16, y + height - 30,
            boxWidth - 32, 24,
            `${fileCount} files • ${couplingPct}% coupling`,
            '#94a3b8',
            14
        ));
    });

    // Generate edges
    addEdges(elements, edges, nodeMap);

    return elements;
}

/**
 * Generate elements for Per-Folder view (files grouped by folder, colored by cluster)
 */
function generatePerFolderView(
    clusters: ClusterData[],
    edges: ClusterEdge[],
    folderDepth: number
): ExcalidrawElement[] {
    const elements: ExcalidrawElement[] = [];

    // Group all files by folder
    const folderMap = new Map<string, FileItem[]>();
    const clusterCouplings = new Map<number, number>();

    clusters.forEach(cluster => {
        clusterCouplings.set(cluster.id, cluster.avg_coupling || 0);
        const files = cluster.files || [];
        files.forEach(filePath => {
            const folder = getFolderAtDepth(filePath, folderDepth);
            if (!folderMap.has(folder)) {
                folderMap.set(folder, []);
            }
            folderMap.get(folder)!.push({
                path: filePath,
                name: getFileName(filePath),
                folder,
                clusterId: cluster.id,
                clusterName: cluster.name || `Cluster ${cluster.id}`
            });
        });
    });

    // Convert to boxes
    const boxes: GroupBox[] = Array.from(folderMap.entries())
        .map(([folder, files]) => {
            // Calculate average coupling for files in this folder
            const avgCoupling = files.reduce((sum, f) =>
                sum + (clusterCouplings.get(f.clusterId) || 0), 0) / files.length;

            return {
                id: folder,
                name: folder || '/',
                files,
                coupling: avgCoupling,
                borderColor: getCouplingColor(avgCoupling)
            };
        })
        .sort((a, b) => b.files.length - a.files.length);

    // Layout boxes
    const cols = Math.max(1, Math.ceil(Math.sqrt(boxes.length)));

    // Calculate dynamic box heights
    const rowHeights: number[] = [];
    let currentRow = 0;
    let maxRowHeight = 0;
    const boxInfos: { x: number; y: number; height: number }[] = [];

    boxes.forEach((box, index) => {
        const col = index % cols;
        if (col === 0 && index > 0) {
            rowHeights.push(maxRowHeight);
            maxRowHeight = 0;
            currentRow++;
        }

        const fileCount = Math.min(box.files.length, 15);
        const dynamicHeight = Math.max(boxHeight, filesStartY + 50 + fileCount * (fileBoxHeight + fileGap + 16));
        maxRowHeight = Math.max(maxRowHeight, dynamicHeight);
        boxInfos.push({ x: 0, y: 0, height: dynamicHeight });
    });
    rowHeights.push(maxRowHeight);

    // Calculate actual positions
    let currentY = 0;
    currentRow = 0;

    boxes.forEach((_, index) => {
        const col = index % cols;
        if (col === 0 && index > 0) {
            currentY += rowHeights[currentRow] + gapY;
            currentRow++;
        }

        const x = col * (boxWidth + gapX);
        boxInfos[index] = { ...boxInfos[index], x, y: currentY };
    });

    // Generate folder boxes
    boxes.forEach((box, index) => {
        const { x, y, height } = boxInfos[index];

        // Main folder rectangle
        elements.push(createRectangle(
            `folder-box-${index}`,
            x, y,
            boxWidth, height,
            box.borderColor,
            '#1e293b'
        ));

        // Folder name
        const displayName = truncateText(box.name, 35);
        elements.push(createText(
            `folder-name-${index}`,
            x + 16, y + 16,
            boxWidth - 32, 24,
            displayName,
            '#f1f5f9',
            18
        ));

        // File items with cluster colors
        const displayFiles = box.files.slice(0, 15);
        const fileWidth = boxWidth - 32;

        displayFiles.forEach((file, fileIndex) => {
            const clusterColor = getClusterColor(file.clusterId);

            const fileX = x + filesStartX;
            const fileY = y + filesStartY + fileIndex * (fileBoxHeight + fileGap + 16);

            // File rectangle with cluster color
            elements.push(createRectangle(
                `file-${index}-${fileIndex}`,
                fileX, fileY,
                fileWidth, fileBoxHeight + 14,
                clusterColor, clusterColor,
                50
            ));

            // File name
            const displayFileName = truncateText(file.name, 40);
            elements.push(createText(
                `filename-${index}-${fileIndex}`,
                fileX + 8, fileY + 5,
                fileWidth - 16, 16,
                displayFileName,
                '#f1f5f9',
                11
            ));

            // Cluster name (smaller text)
            const displayCluster = truncateText(file.clusterName, 45);
            elements.push(createText(
                `cluster-${index}-${fileIndex}`,
                fileX + 8, fileY + 20,
                fileWidth - 16, 14,
                displayCluster,
                '#94a3b8',
                9
            ));
        });

        // Show file count if truncated
        if (box.files.length > 15) {
            elements.push(createText(
                `more-${index}`,
                x + 16, y + filesStartY + 15 * (fileBoxHeight + fileGap + 16) + 5,
                boxWidth - 32, 16,
                `... and ${box.files.length - 15} more files`,
                '#64748b',
                10
            ));
        }

        // Stats text at bottom
        const uniqueClusters = new Set(box.files.map(f => f.clusterId)).size;
        elements.push(createText(
            `stats-${index}`,
            x + 16, y + height - 30,
            boxWidth - 32, 24,
            `${box.files.length} files • ${uniqueClusters} clusters`,
            '#94a3b8',
            14
        ));
    });

    // Note: In folder view, edges are not shown as they represent cluster relationships
    // which don't directly translate to folder groupings
    void edges; // Acknowledge unused parameter

    return elements;
}

/**
 * Add edge elements between nodes
 */
function addEdges(
    elements: ExcalidrawElement[],
    edges: ClusterEdge[],
    nodeMap: Map<number, { x: number; y: number; height?: number }>
) {
    edges.forEach((edge, index) => {
        const from = nodeMap.get(edge.from_cluster);
        const to = nodeMap.get(edge.to_cluster);
        if (!from || !to) return;

        const strength = edge.coupling_strength || 0;

        elements.push(createArrow(
            `edge-${index}`,
            from.x, from.y,
            to.x, to.y,
            strength
        ));

        // Edge label for significant connections
        if (strength > 0.2) {
            const midX = from.x + (to.x - from.x) / 2 - 20;
            const midY = from.y + (to.y - from.y) / 2 - 10;
            elements.push(createText(
                `edge-label-${index}`,
                midX, midY,
                40, 20,
                `${Math.round(strength * 100)}%`,
                '#94a3b8',
                12
            ));
        }
    });
}

/**
 * Main generator function
 */
export function generateExcalidrawElements(
    clusters: ClusterData[],
    edges: ClusterEdge[],
    options: Partial<ExcalidrawGeneratorOptions> = {}
): ExcalidrawElement[] {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (opts.viewMode === 'per-folder') {
        return generatePerFolderView(clusters, edges, opts.folderDepth);
    }

    return generatePerClusterView(clusters, edges, opts.folderDepth);
}
