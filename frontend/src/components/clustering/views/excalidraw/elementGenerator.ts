/**
 * Excalidraw Element Generator
 * 
 * Generates Excalidraw elements from cluster data.
 */

import type { ClusterData, ClusterEdge } from '../types';
import { getCouplingColor, EXCALIDRAW_CONFIG } from '../constants';

const {
    boxWidth,
    boxHeight,
    gapX,
    gapY,
    fileBoxWidth,
    fileBoxHeight,
    fileGap,
    filesPerRow,
    maxFilesPerCluster,
    filesStartY,
    filesStartX
} = EXCALIDRAW_CONFIG;

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

export function generateExcalidrawElements(
    clusters: ClusterData[],
    edges: ClusterEdge[]
): ExcalidrawElement[] {
    const cols = Math.max(1, Math.ceil(Math.sqrt(clusters.length)));
    const nodeMap = new Map<number, { x: number; y: number }>();
    const elements: ExcalidrawElement[] = [];

    // Generate cluster boxes
    clusters.forEach((cluster, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = col * (boxWidth + gapX);
        const y = row * (boxHeight + gapY);
        const coupling = cluster.avg_coupling || 0;

        nodeMap.set(cluster.id, { x: x + boxWidth / 2, y: y + boxHeight / 2 });

        // Main cluster rectangle
        elements.push(createRectangle(
            `cluster-${cluster.id}`,
            x, y,
            boxWidth, boxHeight,
            getCouplingColor(coupling),
            '#1e293b'
        ));

        // Cluster name
        const clusterName = cluster.name || `Cluster ${cluster.id}`;
        const displayName = clusterName.length > 30 ? clusterName.slice(0, 28) + '...' : clusterName;
        elements.push(createText(
            `name-${cluster.id}`,
            x + 16, y + 16,
            boxWidth - 32, 24,
            displayName,
            '#f1f5f9',
            18
        ));

        // File rectangles inside cluster
        const files = cluster.files || [];
        const displayFiles = files.slice(0, maxFilesPerCluster);

        displayFiles.forEach((_, fileIndex) => {
            const fileRow = Math.floor(fileIndex / filesPerRow);
            const fileCol = fileIndex % filesPerRow;
            const fileX = x + filesStartX + fileCol * (fileBoxWidth + fileGap);
            const fileY = y + filesStartY + fileRow * (fileBoxHeight + fileGap);
            const fileColor = getCouplingColor(coupling);

            elements.push(createRectangle(
                `file-${cluster.id}-${fileIndex}`,
                fileX, fileY,
                fileBoxWidth, fileBoxHeight,
                fileColor, fileColor,
                70
            ));
        });

        // Stats text at bottom
        const fileCount = files.length || cluster.size || 0;
        const couplingPct = Math.round(coupling * 100);
        elements.push(createText(
            `stats-${cluster.id}`,
            x + 16, y + boxHeight - 30,
            boxWidth - 32, 24,
            `${fileCount} files • ${couplingPct}% coupling`,
            '#94a3b8',
            14
        ));
    });

    // Generate edges
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

    return elements;
}
