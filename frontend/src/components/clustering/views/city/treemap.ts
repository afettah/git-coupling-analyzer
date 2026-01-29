/**
 * Treemap Layout Algorithm
 * 
 * Implements squarified treemap layout for ProjectCity visualization.
 */

import type { FileData, FolderNode, BuildingData, DistrictData } from '../../types/index';
import { CLUSTER_PALETTE, UNCLUSTERED_COLOR, getCouplingColor, CITY_CONFIG } from '../../constants';

const { buildingWidth, buildingSpacing, minDistrictSize } = CITY_CONFIG;

// ============================================================
// Folder Tree Building
// ============================================================

export function buildFolderTree(files: FileData[]): FolderNode {
    const root: FolderNode = {
        name: '',
        path: '',
        files: [],
        children: new Map(),
        x: 0, y: 0, width: 0, height: 0, depth: 0
    };

    files.forEach(file => {
        const parts = file.path.split('/');
        const filename = parts.pop()!;
        let current = root;

        parts.forEach((part: string, index: number) => {
            const currentPath = parts.slice(0, index + 1).join('/');
            if (!current.children.has(part)) {
                current.children.set(part, {
                    name: part,
                    path: currentPath,
                    files: [],
                    children: new Map(),
                    x: 0, y: 0, width: 0, height: 0, depth: index + 1
                });
            }
            current = current.children.get(part)!;
        });

        current.files.push({ ...file, filename });
    });

    return root;
}

// ============================================================
// Treemap Layout
// ============================================================

function calculateWeight(node: FolderNode): number {
    const fileWeight = node.files.length;
    let childWeight = 0;
    node.children.forEach((child: FolderNode) => {
        childWeight += calculateWeight(child);
    });
    return fileWeight + childWeight;
}

function worstRatio(
    row: { weight: number }[],
    width: number,
    height: number,
    totalWeight: number
): number {
    if (row.length === 0) return Infinity;

    const rowWeight = row.reduce((sum, item) => sum + item.weight, 0);
    const rowRatio = rowWeight / totalWeight;
    const isHorizontal = width >= height;
    const rowSize = isHorizontal ? height * rowRatio : width * rowRatio;

    let worst = 0;
    row.forEach(item => {
        const itemRatio = item.weight / rowWeight;
        const itemSize = isHorizontal ? width * itemRatio : height * itemRatio;
        const ratio = Math.max(rowSize / itemSize, itemSize / rowSize);
        worst = Math.max(worst, ratio);
    });

    return worst;
}

interface LayoutItem {
    node: FolderNode | null;
    file: FileData | null;
    weight: number;
}

function layoutRow(
    row: LayoutItem[],
    x: number, y: number,
    width: number, height: number,
    totalWeight: number
): { x: number; y: number; width: number; height: number } {
    const rowWeight = row.reduce((sum, item) => sum + item.weight, 0);
    const rowRatio = rowWeight / totalWeight;
    const isHorizontal = width >= height;
    const rowSize = isHorizontal ? height * rowRatio : width * rowRatio;

    let offset = 0;
    row.forEach(item => {
        const itemRatio = item.weight / rowWeight;
        const itemSize = isHorizontal ? width * itemRatio : height * itemRatio;

        if (item.node) {
            if (isHorizontal) {
                item.node.x = x + offset;
                item.node.y = y;
                item.node.width = itemSize;
                item.node.height = rowSize;
            } else {
                item.node.x = x;
                item.node.y = y + offset;
                item.node.width = rowSize;
                item.node.height = itemSize;
            }
        }
        offset += itemSize;
    });

    if (isHorizontal) {
        return { x, y: y + rowSize, width, height: height - rowSize };
    }
    return { x: x + rowSize, y, width: width - rowSize, height };
}

function squarify(
    items: LayoutItem[],
    x: number, y: number,
    width: number, height: number
): void {
    if (items.length === 0) return;

    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight === 0) return;

    items.sort((a, b) => b.weight - a.weight);

    let currentRow: LayoutItem[] = [];
    let remainingItems = [...items];
    let cx = x, cy = y, cw = width, ch = height;

    while (remainingItems.length > 0) {
        const item = remainingItems[0];
        const testRow = [...currentRow, item];

        if (currentRow.length === 0 ||
            worstRatio(testRow, cw, ch, totalWeight) <= worstRatio(currentRow, cw, ch, totalWeight)) {
            currentRow.push(item);
            remainingItems.shift();
        } else {
            const result = layoutRow(currentRow, cx, cy, cw, ch, totalWeight);
            cx = result.x;
            cy = result.y;
            cw = result.width;
            ch = result.height;
            currentRow = [];
        }
    }

    if (currentRow.length > 0) {
        layoutRow(currentRow, cx, cy, cw, ch, totalWeight);
    }
}

export function layoutTreemap(
    root: FolderNode,
    x: number, y: number,
    width: number, height: number,
    maxDepth: number,
    folderGap: number,
    labelMargin: number
): void {
    root.x = x;
    root.y = y;
    root.width = width;
    root.height = height;

    if (root.depth >= maxDepth) return;

    const items: LayoutItem[] = [];
    root.children.forEach((child: FolderNode) => {
        const weight = calculateWeight(child);
        if (weight > 0) {
            items.push({ node: child, file: null, weight });
        }
    });

    if (items.length === 0) return;

    // Alternate label position: even depth = top, odd depth = left
    // This ensures labels are OUTSIDE the content area
    const labelOnTop = root.depth % 2 === 0;
    const innerPadding = 0.3;

    let innerX: number, innerY: number, innerWidth: number, innerHeight: number;

    // Content area is ALWAYS reduced by labelMargin in the appropriate direction
    // This guarantees buildings stay inside while labels stay outside
    if (labelOnTop) {
        // Label at top edge, content below
        innerX = x + innerPadding;
        innerY = y + labelMargin + innerPadding; // Push content down for label
        innerWidth = Math.max(0, width - innerPadding * 2);
        innerHeight = Math.max(0, height - labelMargin - innerPadding * 2);
    } else {
        // Label at left edge, content to the right
        innerX = x + labelMargin + innerPadding; // Push content right for label
        innerY = y + innerPadding;
        innerWidth = Math.max(0, width - labelMargin - innerPadding * 2);
        innerHeight = Math.max(0, height - innerPadding * 2);
    }

    squarify(items, innerX, innerY, innerWidth, innerHeight);

    // Apply gap between folders
    items.forEach(item => {
        if (item.node) {
            const gap = folderGap / 2;
            item.node.x += gap;
            item.node.y += gap;
            item.node.width = Math.max(0, item.node.width - folderGap);
            item.node.height = Math.max(0, item.node.height - folderGap);
        }
    });

    // Recursively layout children
    items.forEach(item => {
        if (item.node) {
            layoutTreemap(
                item.node,
                item.node.x, item.node.y,
                item.node.width, item.node.height,
                maxDepth, folderGap, labelMargin
            );
        }
    });
}

// ============================================================
// District & Building Collection
// ============================================================

export function collectDistricts(
    node: FolderNode,
    districts: DistrictData[],
    labelMargin: number
): void {
    if (node.width >= minDistrictSize && node.height >= minDistrictSize && node.path) {
        // Match the label position logic from layoutTreemap EXACTLY
        // In layoutTreemap: labelOnTop = root.depth % 2 === 0 (even depth = top)
        const labelOnTop = node.depth % 2 === 0;
        districts.push({
            x: node.x,
            z: node.y,
            width: node.width,
            depth: node.height,
            name: node.name,
            path: node.path,
            level: node.depth,
            labelPosition: labelOnTop ? 'top' : 'left',
            labelMargin
        });
    }

    node.children.forEach((child: FolderNode) => {
        collectDistricts(child, districts, labelMargin);
    });
}

export function collectBuildings(
    node: FolderNode,
    buildings: BuildingData[],
    clusterIndexMap: Map<number, number>,
    heightScaleFactor: number,
    labelMargin: number,
    colorBy: 'cluster' | 'coupling',
    customPalette?: string[],
    customUnclusteredColor?: string
): void {
    // Use custom palette or default
    const palette = customPalette || CLUSTER_PALETTE;
    const unclusteredColor = customUnclusteredColor || UNCLUSTERED_COLOR;

    // Match the label position logic from layoutTreemap EXACTLY
    // In layoutTreemap: labelOnTop = root.depth % 2 === 0 (even depth = top)
    // This must be consistent to position buildings correctly
    const labelOnTop = node.depth % 2 === 0; // Even depth = label on top
    const padding = 0.4; // Slightly larger padding to ensure buildings stay inside

    let innerX: number, innerY: number, innerWidth: number, innerHeight: number;

    // Calculate content area accounting for where the label is positioned
    if (labelOnTop) {
        // Label at top, content area is below
        innerX = node.x + padding;
        innerY = node.y + labelMargin + padding;
        innerWidth = Math.max(0, node.width - padding * 2);
        innerHeight = Math.max(0, node.height - labelMargin - padding * 2);
    } else {
        // Label at left, content area is to the right
        innerX = node.x + labelMargin + padding;
        innerY = node.y + padding;
        innerWidth = Math.max(0, node.width - labelMargin - padding * 2);
        innerHeight = Math.max(0, node.height - padding * 2);
    }

    if (node.files.length > 0 && innerWidth > 0 && innerHeight > 0) {
        const cellSize = buildingWidth + buildingSpacing;
        const cols = Math.max(1, Math.floor(innerWidth / cellSize));
        const rows = Math.ceil(node.files.length / cols);

        // Calculate scale factors to ensure all buildings fit within content area
        const requiredWidth = cols * cellSize;
        const requiredHeight = rows * cellSize;
        const widthScale = requiredWidth > innerWidth ? innerWidth / requiredWidth : 1;
        const depthScale = requiredHeight > innerHeight ? innerHeight / requiredHeight : 1;
        const scale = Math.min(widthScale, depthScale, 1);
        const scaledCellSize = cellSize * scale;
        const scaledBuildingWidth = buildingWidth * scale;

        node.files.forEach((file: FileData, index: number) => {
            const row = Math.floor(index / cols);
            const col = index % cols;
            const loc = file.loc || 100;
            const baseHeight = Math.log10(loc + 1);
            const height = Math.max(0.2, baseHeight * heightScaleFactor);

            const clusterIndex = file.clusterIndex !== null ? file.clusterIndex : -1;
            let color: string;

            if (colorBy === 'coupling') {
                color = getCouplingColor(file.coupling);
            } else {
                color = clusterIndex >= 0
                    ? palette[clusterIndex % palette.length]
                    : unclusteredColor;
            }

            // Position buildings ensuring they stay within bounds
            const buildingX = innerX + col * scaledCellSize + scaledBuildingWidth / 2;
            const buildingZ = innerY + row * scaledCellSize + scaledBuildingWidth / 2;

            // Final bounds check
            const maxX = innerX + innerWidth - scaledBuildingWidth / 2;
            const maxZ = innerY + innerHeight - scaledBuildingWidth / 2;

            buildings.push({
                x: Math.min(buildingX, maxX),
                z: Math.min(buildingZ, maxZ),
                height,
                width: scaledBuildingWidth,
                depth: scaledBuildingWidth,
                color,
                label: file.filename,
                fullPath: file.path,
                coupling: file.coupling,
                clusterId: file.clusterId,
                folder: node.path || 'root'
            });
        });
    }

    node.children.forEach((child: FolderNode) => {
        collectBuildings(child, buildings, clusterIndexMap, heightScaleFactor, labelMargin, colorBy, customPalette, customUnclusteredColor);
    });
}