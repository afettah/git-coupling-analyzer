import { useCallback, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
// @ts-ignore - Box and Plane are exported from shapes
import { Box, Plane } from '@react-three/drei';
import { Camera, FolderTree, Eye, EyeOff, FileText } from 'lucide-react';
import * as THREE from 'three';
import { generateClusterName, calculateClusterRank } from './utils';
import ClusterFilters, { type ClusterFilterState } from './ClusterFilters';

interface ProjectCityProps {
    clusters: any[];
}

// Color palette for clusters
const clusterPalette = [
    '#38bdf8', '#22c55e', '#f97316', '#e879f9', '#facc15',
    '#60a5fa', '#34d399', '#fb7185', '#a78bfa', '#fbbf24',
    '#2dd4bf', '#f472b6', '#818cf8', '#fb923c', '#4ade80',
    '#c084fc', '#fcd34d', '#67e8f9', '#f87171', '#a3e635'
];

// Unclustered files color (gray)
const UNCLUSTERED_COLOR = '#64748b';

interface FileData {
    path: string;
    filename: string;
    coupling: number;
    clusterId: number | null;
    clusterIndex: number | null;
    loc?: number;
}

interface FolderNode {
    name: string;
    path: string;
    files: FileData[];
    children: Map<string, FolderNode>;
    // Layout properties (calculated later)
    x: number;
    y: number;
    width: number;
    height: number;
    depth: number;
}

interface BuildingData {
    x: number;
    z: number;
    height: number;
    width: number;
    depth: number;
    color: string;
    label: string;
    fullPath: string;
    coupling: number;
    clusterId: number | null;
    folder: string;
}

interface DistrictData {
    x: number;
    z: number;
    width: number;
    depth: number;
    name: string;
    path: string;
    level: number;
    // Label positioning info
    labelPosition: 'top' | 'left';
    labelMargin: number;
}

// Build folder tree from file paths
function buildFolderTree(files: FileData[]): FolderNode {
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

        parts.forEach((part, index) => {
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

// Calculate total weight of a folder (files + children)
function calculateWeight(node: FolderNode): number {
    const fileWeight = node.files.length;
    let childWeight = 0;
    node.children.forEach(child => {
        childWeight += calculateWeight(child);
    });
    return fileWeight + childWeight;
}

// Squarified treemap layout algorithm
function squarify(
    items: { node: FolderNode | null; file: FileData | null; weight: number }[],
    x: number, y: number, width: number, height: number
): void {
    if (items.length === 0) return;

    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight === 0) return;

    // Sort by weight descending for better squarification
    items.sort((a, b) => b.weight - a.weight);

    let currentRow: typeof items = [];
    let remainingItems = [...items];
    let cx = x, cy = y, cw = width, ch = height;

    while (remainingItems.length > 0) {
        const item = remainingItems[0];
        const testRow = [...currentRow, item];

        if (currentRow.length === 0 || worstRatio(testRow, cw, ch, totalWeight) <= worstRatio(currentRow, cw, ch, totalWeight)) {
            currentRow.push(item);
            remainingItems.shift();
        } else {
            // Layout current row
            const rowResult = layoutRow(currentRow, cx, cy, cw, ch, totalWeight);
            cx = rowResult.x;
            cy = rowResult.y;
            cw = rowResult.width;
            ch = rowResult.height;
            currentRow = [];
        }
    }

    // Layout remaining items
    if (currentRow.length > 0) {
        layoutRow(currentRow, cx, cy, cw, ch, totalWeight);
    }
}

function worstRatio(row: { weight: number }[], width: number, height: number, totalWeight: number): number {
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

function layoutRow(
    row: { node: FolderNode | null; file: FileData | null; weight: number }[],
    x: number, y: number, width: number, height: number, totalWeight: number
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
    } else {
        return { x: x + rowSize, y, width: width - rowSize, height };
    }
}

// Layout the folder tree using treemap algorithm
// labelMargin: outer margin for folder labels to prevent overlap
function layoutTreemap(root: FolderNode, x: number, y: number, width: number, height: number, maxDepth: number = 4, folderGap: number = 1.0, labelMargin: number = 1.5): void {
    root.x = x;
    root.y = y;
    root.width = width;
    root.height = height;

    if (root.depth >= maxDepth) {
        return;
    }

    // Collect children
    const items: { node: FolderNode | null; file: FileData | null; weight: number }[] = [];

    root.children.forEach(child => {
        const weight = calculateWeight(child);
        if (weight > 0) {
            items.push({ node: child, file: null, weight });
        }
    });

    if (items.length === 0) return;

    // Alternate label position by depth level: top -> left -> top -> left...
    const labelOnTop = root.depth % 2 === 0;
    
    // Calculate padding based on label position
    // Add extra margin outside the folder boundary for the label
    const outerMargin = labelMargin; // Margin outside folder for label
    const innerPadding = 0.3; // Small inner padding
    
    let innerX, innerY, innerWidth, innerHeight;
    
    if (labelOnTop) {
        // Label at top - add vertical space
        innerX = x + innerPadding;
        innerY = y + outerMargin + innerPadding;
        innerWidth = Math.max(0, width - innerPadding * 2);
        innerHeight = Math.max(0, height - outerMargin - innerPadding * 2);
    } else {
        // Label on left - add horizontal space
        innerX = x + outerMargin + innerPadding;
        innerY = y + innerPadding;
        innerWidth = Math.max(0, width - outerMargin - innerPadding * 2);
        innerHeight = Math.max(0, height - innerPadding * 2);
    }

    squarify(items, innerX, innerY, innerWidth, innerHeight);

    // Apply gap between folders by shrinking each child
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
            layoutTreemap(item.node, item.node.x, item.node.y, item.node.width, item.node.height, maxDepth, folderGap, labelMargin);
        }
    });
}

// Collect all districts (folder rectangles) from the tree
function collectDistricts(node: FolderNode, districts: DistrictData[], minSize: number = 2, labelMargin: number = 1.5): void {
    if (node.width >= minSize && node.height >= minSize && node.path) {
        // Alternate label position by depth: top (even) -> left (odd) -> top...
        const labelOnTop = node.depth % 2 === 1; // Offset by 1 since we want parent's depth to determine child label position
        
        districts.push({
            x: node.x,
            z: node.y,
            width: node.width,
            depth: node.height,
            name: node.name,
            path: node.path,
            level: node.depth,
            labelPosition: labelOnTop ? 'top' : 'left',
            labelMargin: labelMargin
        });
    }

    node.children.forEach(child => {
        collectDistricts(child, districts, minSize, labelMargin);
    });
}

// Fixed building width for all files
const BUILDING_WIDTH = 0.6;
const BUILDING_SPACING = 0.15;

// Collect all files with their positions from the tree
function collectBuildings(
    node: FolderNode,
    buildings: BuildingData[],
    clusterIndexMap: Map<number, number>,
    heightScaleFactor: number,
    labelMargin: number = 1.5
): void {
    // Alternate label position by depth: top (even) -> left (odd) -> top...
    const labelOnTop = node.depth % 2 === 1;
    const padding = 0.3;
    
    let innerX, innerY, innerWidth, innerHeight;
    
    if (labelOnTop) {
        // Label at top - leave vertical space
        innerX = node.x + padding;
        innerY = node.y + labelMargin + padding;
        innerWidth = Math.max(0, node.width - padding * 2);
        innerHeight = Math.max(0, node.height - labelMargin - padding * 2);
    } else {
        // Label on left - leave horizontal space
        innerX = node.x + labelMargin + padding;
        innerY = node.y + padding;
        innerWidth = Math.max(0, node.width - labelMargin - padding * 2);
        innerHeight = Math.max(0, node.height - padding * 2);
    }

    if (node.files.length > 0 && innerWidth > 0 && innerHeight > 0) {
        // Calculate grid for files with fixed building width
        const cellSize = BUILDING_WIDTH + BUILDING_SPACING;

        // Calculate how many columns can fit
        const cols = Math.max(1, Math.floor(innerWidth / cellSize));

        node.files.forEach((file, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;

            // Log scale for height based on LOC (lines of code)
            // Use a default LOC if not available
            const loc = file.loc || 100;
            const baseHeight = Math.log10(loc + 1);
            const height = Math.max(0.2, baseHeight * heightScaleFactor);

            const clusterIndex = file.clusterIndex !== null ? file.clusterIndex : -1;
            const color = clusterIndex >= 0
                ? clusterPalette[clusterIndex % clusterPalette.length]
                : UNCLUSTERED_COLOR;

            buildings.push({
                x: innerX + col * cellSize + BUILDING_WIDTH / 2,
                z: innerY + row * cellSize + BUILDING_WIDTH / 2,
                height,
                width: BUILDING_WIDTH,
                depth: BUILDING_WIDTH,
                color,
                label: file.filename,
                fullPath: file.path,
                coupling: file.coupling,
                clusterId: file.clusterId,
                folder: node.path || 'root'
            });
        });
    }

    // Process children
    node.children.forEach(child => {
        collectBuildings(child, buildings, clusterIndexMap, heightScaleFactor, labelMargin);
    });
}

interface BuildingProps {
    building: BuildingData;
    onHover: (building: BuildingData | null) => void;
    onClick: (building: BuildingData) => void;
    isHighlighted: boolean;
    isGrayed: boolean;
    showFileName: boolean;
}

// Gray color for non-selected clusters
const GRAYED_COLOR = '#374151';

function Building({ building, onHover, onClick, isHighlighted, isGrayed, showFileName }: BuildingProps) {
    const displayColor = isGrayed ? GRAYED_COLOR : building.color;
    
    // Calculate font size based on building dimensions
    const fontSize = Math.min(building.width * 0.4, 0.25);
    // Truncate filename if too long
    const displayName = building.label.length > 12 
        ? building.label.slice(0, 10) + '..'
        : building.label;

    return (
        <group position={[building.x, building.height / 2, building.z]}>
            <Box
                args={[building.width, building.height, building.depth]}
                onPointerOver={(e: any) => { e.stopPropagation(); onHover(building); }}
                onPointerOut={() => onHover(null)}
                onClick={(e: any) => { e.stopPropagation(); onClick(building); }}
                castShadow
                receiveShadow
            >
                <meshStandardMaterial
                    color={displayColor}
                    transparent
                    opacity={isGrayed ? 0.4 : (isHighlighted ? 1 : 0.9)}
                    emissive={isHighlighted && !isGrayed ? building.color : '#000000'}
                    emissiveIntensity={isHighlighted && !isGrayed ? 0.4 : 0}
                    roughness={0.7}
                    metalness={0.1}
                />
            </Box>
            {/* File name label - vertical text on top of building */}
            {showFileName && !isGrayed && (
                <Text
                    position={[0, building.height / 2 + 0.1, 0]}
                    fontSize={fontSize}
                    color="#e2e8f0"
                    anchorX="center"
                    anchorY="bottom"
                    rotation={[-Math.PI / 2, 0, Math.PI / 2]} // Lay flat, rotated 90° for vertical reading
                    outlineWidth={0.01}
                    outlineColor="#0f172a"
                    maxWidth={building.height * 0.8}
                >
                    {displayName}
                </Text>
            )}
        </group>
    );
}

interface DistrictProps {
    district: DistrictData;
    isHovered: boolean;
}

function District({ district, isHovered }: DistrictProps) {
    // Different colors for different depth levels
    const levelColors = [
        '#1e293b', // Level 0 - darkest
        '#334155', // Level 1
        '#475569', // Level 2
        '#64748b', // Level 3
        '#94a3b8', // Level 4 - lightest
    ];

    const color = levelColors[Math.min(district.level, levelColors.length - 1)];
    const borderHeight = 0.05 + district.level * 0.02;

    return (
        <group position={[district.x + district.width / 2, borderHeight / 2, district.z + district.depth / 2]}>
            {/* District floor */}
            <Box args={[district.width - 0.1, borderHeight, district.depth - 0.1]}>
                <meshStandardMaterial
                    color={color}
                    transparent
                    opacity={isHovered ? 0.9 : 0.6}
                    roughness={0.9}
                />
            </Box>
            {/* District border */}
            <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(district.width, borderHeight, district.depth)]} />
                <lineBasicMaterial color={isHovered ? '#38bdf8' : '#475569'} linewidth={1} />
            </lineSegments>
        </group>
    );
}

interface DistrictLabelProps {
    district: DistrictData;
}

function DistrictLabel({ district }: DistrictLabelProps) {
    // Only show labels for districts that are large enough
    const minSize = district.labelPosition === 'top' ? 2 : 2.5;
    if (district.width < minSize || district.depth < minSize) return null;

    // Scale font size based on district size and position
    // Make it smaller for left-positioned labels to fit better
    const baseFontSize = district.labelPosition === 'top'
        ? Math.min(Math.max(0.5, district.width * 0.1), 1.2)
        : Math.min(Math.max(0.4, district.depth * 0.08), 1.0);
    
    const fontSize = baseFontSize;
    const labelY = 0.12 + district.level * 0.04; // Slightly above ground, higher for deeper levels
    
    // Position label based on labelPosition setting
    // Place label OUTSIDE the folder boundary in the margin area
    let labelX: number, labelZ: number;
    let rotation: [number, number, number];
    let anchorX: 'left' | 'center' | 'right';
    let anchorY: 'top' | 'middle' | 'bottom';
    let maxLabelWidth: number;
    
    if (district.labelPosition === 'top') {
        // Label at top - position above the district content area
        labelX = district.x + 0.3;
        labelZ = district.z + 0.3; // In the margin area at top
        rotation = [-Math.PI / 2, 0, 0]; // Lay flat
        anchorX = 'left';
        anchorY = 'top';
        maxLabelWidth = district.width - 0.6;
    } else {
        // Label on left - position in the left margin, rotated vertically
        labelX = district.x + 0.3; // In the margin area on left
        labelZ = district.z + district.depth - 0.3;
        rotation = [-Math.PI / 2, 0, Math.PI / 2]; // Lay flat, rotated 90° for vertical reading
        anchorX = 'left';
        anchorY = 'top';
        maxLabelWidth = district.depth - 0.6;
    }

    return (
        <Text
            position={[labelX, labelY, labelZ]}
            fontSize={fontSize}
            color="#f1f5f9"
            anchorX={anchorX}
            anchorY={anchorY}
            maxWidth={maxLabelWidth}
            rotation={rotation}
            outlineWidth={0.02}
            outlineColor="#0f172a"
        >
            {district.name}
        </Text>
    );
}

interface CitySceneProps {
    buildings: BuildingData[];
    districts: DistrictData[];
    hoveredBuilding: BuildingData | null;
    setHoveredBuilding: (b: BuildingData | null) => void;
    onBuildingClick: (b: BuildingData) => void;
    selectedCluster: number | null;
    hideUnselected: boolean;
    showFolderLabels: boolean;
    showFileLabels: boolean;
    gridSize: number;
}

function CityScene({
    buildings,
    districts,
    hoveredBuilding,
    setHoveredBuilding,
    onBuildingClick,
    selectedCluster,
    hideUnselected,
    showFolderLabels,
    showFileLabels,
    gridSize
}: CitySceneProps) {
    const hoveredDistrict = hoveredBuilding?.folder;

    // Filter buildings based on selection and hide mode
    const visibleBuildings = useMemo(() => {
        if (selectedCluster === null || !hideUnselected) {
            return buildings;
        }
        return buildings.filter(b => b.clusterId === selectedCluster);
    }, [buildings, selectedCluster, hideUnselected]);

    // Filter districts to show only those with visible files when hiding unselected
    const visibleDistricts = useMemo(() => {
        if (selectedCluster === null || !hideUnselected) {
            return districts;
        }
        return districts.filter(d => {
            // Check if any child of this district contains visible buildings
            return visibleBuildings.some(b =>
                b.folder === d.path || b.folder.startsWith(d.path + '/')
            );
        });
    }, [districts, selectedCluster, hideUnselected, visibleBuildings]);

    return (
        <>
            {/* Lighting */}
            <ambientLight intensity={0.4} />
            <directionalLight
                position={[gridSize, gridSize * 0.8, gridSize * 0.5]}
                intensity={0.7}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-camera-far={gridSize * 3}
                shadow-camera-left={-gridSize}
                shadow-camera-right={gridSize}
                shadow-camera-top={gridSize}
                shadow-camera-bottom={-gridSize}
            />
            <pointLight position={[-gridSize / 2, gridSize / 2, -gridSize / 2]} intensity={0.2} />
            <hemisphereLight args={['#87ceeb', '#362907', 0.3]} />

            {/* Ground plane */}
            <Plane
                args={[gridSize * 1.5, gridSize * 1.5]}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[gridSize / 2, -0.01, gridSize / 2]}
                receiveShadow
            >
                <meshStandardMaterial color="#0a0f1a" />
            </Plane>

            {/* Grid helper */}
            <gridHelper
                args={[gridSize * 1.5, Math.floor(gridSize * 1.5), '#1e293b', '#0f172a']}
                position={[gridSize / 2, 0, gridSize / 2]}
            />

            {/* Districts (folder squares) */}
            {visibleDistricts.map((district, index) => (
                <District
                    key={`district-${district.path}-${index}`}
                    district={district}
                    isHovered={hoveredDistrict === district.path}
                />
            ))}

            {/* District labels */}
            {showFolderLabels && visibleDistricts.map((district, index) => (
                <DistrictLabel
                    key={`label-${district.path}-${index}`}
                    district={district}
                />
            ))}

            {/* Buildings */}
            {visibleBuildings.map((building, index) => (
                <Building
                    key={`${building.fullPath}-${index}`}
                    building={building}
                    onHover={setHoveredBuilding}
                    onClick={onBuildingClick}
                    isHighlighted={
                        (hoveredBuilding?.clusterId !== null && hoveredBuilding?.clusterId === building.clusterId) ||
                        (selectedCluster !== null && selectedCluster === building.clusterId)
                    }
                    isGrayed={selectedCluster !== null && building.clusterId !== selectedCluster}
                    showFileName={showFileLabels}
                />
            ))}

            {/* Camera controls */}
            <OrbitControls
                enablePan
                enableZoom
                enableRotate
                maxPolarAngle={Math.PI / 2.1}
                minDistance={5}
                maxDistance={gridSize * 2}
                target={[gridSize / 2, 0, gridSize / 2]}
            />
        </>
    );
}

export default function ProjectCity({ clusters }: ProjectCityProps) {
    const [hoveredBuilding, setHoveredBuilding] = useState<BuildingData | null>(null);
    const [selectedCluster, setSelectedCluster] = useState<number | null>(null);
    const [hideUnselected, setHideUnselected] = useState(false);
    const [showFolderLabels, setShowFolderLabels] = useState(true);
    const [showFileLabels, setShowFileLabels] = useState(false);
    const [maxDepth, setMaxDepth] = useState(4);
    const [heightScaleFactor, setHeightScaleFactor] = useState(1.5);
    const [folderGap, setFolderGap] = useState(0.8);
    const [labelMargin, setLabelMargin] = useState(1.5);
    const [showClusterFilesOnly, setShowClusterFilesOnly] = useState(true);
    const [colorBy, setColorBy] = useState<'cluster' | 'coupling'>('cluster');

    // Unified filter state
    const maxFileCount = useMemo(() => {
        return Math.max(...clusters.map((c: any) => c.files?.length || c.size || 0), 100);
    }, [clusters]);

    const [filters, setFilters] = useState<ClusterFilterState>({
        minClusterSize: 2,
        couplingRange: [0.05, 1],
        fileRange: [0, maxFileCount],
        search: ''
    });

    // Filter clusters by minimum size, add smart names, and sort by rank
    const filteredClusters = useMemo(() => {
        return clusters
            .filter((cluster: any) => {
                const fileCount = cluster.files?.length || cluster.size || 0;
                return fileCount >= filters.minClusterSize;
            })
            .map((cluster: any) => ({
                ...cluster,
                name: cluster.name || generateClusterName(cluster.files || [])
            }))
            .sort((a, b) => calculateClusterRank(b) - calculateClusterRank(a)); // Sort by rank descending
    }, [clusters, filters.minClusterSize]);

    // Build cluster index map (based on filtered clusters)
    const clusterIndexMap = useMemo(() => {
        const map = new Map<number, number>();
        filteredClusters.forEach((cluster, index) => {
            map.set(cluster.id, index);
        });
        return map;
    }, [filteredClusters]);

    // Collect all files from filtered clusters
    const allFiles = useMemo((): FileData[] => {
        const files: FileData[] = [];

        filteredClusters.forEach((cluster, clusterIndex) => {
            const clusterFiles = cluster.files || [];
            clusterFiles.forEach((filePath: string) => {
                files.push({
                    path: filePath,
                    filename: filePath.split('/').pop() || filePath,
                    coupling: cluster.avg_coupling || 0.5,
                    clusterId: cluster.id,
                    clusterIndex,
                    loc: Math.floor(Math.random() * 500) + 50 // TODO: Get real LOC from backend
                });
            });
        });

        return files;
    }, [filteredClusters]);

    // Filter files based on settings
    const filteredFiles = useMemo(() => {
        return allFiles.filter(file => {
            if (file.coupling < filters.couplingRange[0] || file.coupling > filters.couplingRange[1]) return false;
            if (filters.search) {
                const query = filters.search.toLowerCase();
                if (!file.path.toLowerCase().includes(query) && !file.filename.toLowerCase().includes(query)) {
                    return false;
                }
            }
            if (showClusterFilesOnly && file.clusterId === null) return false;
            return true;
        });
    }, [allFiles, filters.couplingRange, filters.search, showClusterFilesOnly]);

    // Build treemap layout
    const { buildings, districts, gridSize } = useMemo(() => {
        if (filteredFiles.length === 0) {
            return { buildings: [], districts: [], gridSize: 20 };
        }

        // Build folder tree
        const root = buildFolderTree(filteredFiles);

        // Calculate initial size based on file count
        const totalFiles = filteredFiles.length;
        const baseSize = Math.max(30, Math.sqrt(totalFiles) * 5);

        // Layout the tree with folder gap and label margin
        layoutTreemap(root, 0, 0, baseSize, baseSize, maxDepth, folderGap, labelMargin);

        // Collect districts with label margin info
        const districts: DistrictData[] = [];
        collectDistricts(root, districts, 2, labelMargin);

        // Collect buildings with label margin
        const buildings: BuildingData[] = [];
        collectBuildings(root, buildings, clusterIndexMap, heightScaleFactor, labelMargin);

        // Apply color by mode
        if (colorBy === 'coupling') {
            buildings.forEach(b => {
                if (b.coupling >= 0.8) b.color = '#ef4444';
                else if (b.coupling >= 0.6) b.color = '#f97316';
                else if (b.coupling >= 0.4) b.color = '#facc15';
                else if (b.coupling >= 0.2) b.color = '#22c55e';
                else b.color = '#38bdf8';
            });
        }

        return {
            buildings,
            districts,
            gridSize: baseSize
        };
    }, [filteredFiles, clusterIndexMap, maxDepth, heightScaleFactor, colorBy, folderGap, labelMargin]);

    const handleScreenshot = useCallback(() => {
        const canvas = document.querySelector('#city-canvas canvas') as HTMLCanvasElement;
        if (!canvas) return;

        const link = document.createElement('a');
        link.download = 'project-city.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    }, []);

    const handleClusterClick = useCallback((clusterId: number) => {
        setSelectedCluster(prev => prev === clusterId ? null : clusterId);
    }, []);

    const handleBuildingClick = useCallback((building: BuildingData) => {
        if (building.clusterId !== null) {
            setSelectedCluster(prev => prev === building.clusterId ? null : building.clusterId);
        }
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedCluster(null);
        setHideUnselected(false);
    }, []);

    return (
        <div className="space-y-4">
            {/* Unified Filter Bar */}
            <ClusterFilters
                filters={filters}
                onFiltersChange={setFilters}
                maxFileCount={maxFileCount}
                filteredCount={filteredClusters.length}
                totalCount={clusters.length}
                showFileRange={false}
                countLabel="clusters"
            />

            {/* Visualization Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-900/50 border border-slate-800 rounded-xl">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400">Color by:</label>
                        <select
                            value={colorBy}
                            onChange={(e) => setColorBy(e.target.value as 'cluster' | 'coupling')}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                        >
                            <option value="cluster">Cluster</option>
                            <option value="coupling">Coupling Strength</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400">Depth:</label>
                        <select
                            value={maxDepth}
                            onChange={(e) => setMaxDepth(parseInt(e.target.value))}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                        >
                            <option value="2">2 levels</option>
                            <option value="3">3 levels</option>
                            <option value="4">4 levels</option>
                            <option value="5">5 levels</option>
                            <option value="6">6 levels</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400">Height:</label>
                        <input
                            type="range"
                            min="0.5"
                            max="3"
                            step="0.25"
                            value={heightScaleFactor}
                            onChange={(e) => setHeightScaleFactor(parseFloat(e.target.value))}
                            className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                        />
                        <span className="text-xs text-slate-500 w-6">{heightScaleFactor}x</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400">Gap:</label>
                        <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.2"
                            value={folderGap}
                            onChange={(e) => setFolderGap(parseFloat(e.target.value))}
                            className="w-12 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                        />
                        <span className="text-xs text-slate-500 w-4">{folderGap}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400">Files:</label>
                        <select
                            value={showClusterFilesOnly ? 'cluster' : 'all'}
                            onChange={(e) => setShowClusterFilesOnly(e.target.value === 'cluster')}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                        >
                            <option value="cluster">Cluster files only</option>
                            <option value="all">All files</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400">Margin:</label>
                        <input
                            type="range"
                            min="0.5"
                            max="3"
                            step="0.25"
                            value={labelMargin}
                            onChange={(e) => setLabelMargin(parseFloat(e.target.value))}
                            className="w-12 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                        />
                        <span className="text-xs text-slate-500 w-4">{labelMargin}</span>
                    </div>
                    <button
                        onClick={() => setShowFolderLabels(!showFolderLabels)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-lg transition-colors ${showFolderLabels
                            ? 'bg-slate-700 text-slate-200'
                            : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                            }`}
                        title="Show folder names"
                    >
                        <FolderTree className="w-3.5 h-3.5" />
                        Folders
                    </button>
                    <button
                        onClick={() => setShowFileLabels(!showFileLabels)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-lg transition-colors ${showFileLabels
                            ? 'bg-slate-700 text-slate-200'
                            : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                            }`}
                        title="Show file names on buildings"
                    >
                        <FileText className="w-3.5 h-3.5" />
                        Files
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{buildings.length} buildings</span>
                    <button
                        onClick={handleScreenshot}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors"
                    >
                        <Camera className="w-3.5 h-3.5" />
                        Screenshot
                    </button>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                {colorBy === 'cluster' ? (
                    <>
                        <span className="text-slate-500">Clusters ({filteredClusters.length}):</span>

                        {/* Show selected cluster info and controls when a cluster is selected */}
                        {selectedCluster !== null && (
                            <div className="flex items-center gap-2 px-2 py-1 bg-slate-800/50 border border-slate-700 rounded-lg">
                                <span className="text-slate-300">
                                    Selected: {filteredClusters.find(c => c.id === selectedCluster)?.name || `Cluster ${selectedCluster}`}
                                </span>
                                <button
                                    onClick={() => setHideUnselected(!hideUnselected)}
                                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${hideUnselected
                                        ? 'bg-sky-600 text-white'
                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                        }`}
                                    title={hideUnselected ? 'Show all buildings' : 'Hide other buildings'}
                                >
                                    {hideUnselected ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                    {hideUnselected ? 'Hidden' : 'Hide others'}
                                </button>
                                <button
                                    onClick={clearSelection}
                                    className="text-slate-400 hover:text-slate-200"
                                    title="Clear selection"
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        {/* Cluster buttons */}
                        {filteredClusters.slice(0, 8).map((cluster, i) => {
                            const isSelected = selectedCluster === cluster.id;
                            const isGrayed = selectedCluster !== null && !isSelected;

                            return (
                                <button
                                    key={cluster.id}
                                    onClick={() => handleClusterClick(cluster.id)}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${isSelected
                                        ? 'bg-slate-700 ring-1 ring-sky-500'
                                        : isGrayed
                                            ? 'opacity-50 hover:opacity-75'
                                            : 'hover:bg-slate-800'
                                        }`}
                                >
                                    <span
                                        className="w-2.5 h-2.5 rounded-sm"
                                        style={{
                                            backgroundColor: isGrayed
                                                ? GRAYED_COLOR
                                                : clusterPalette[i % clusterPalette.length]
                                        }}
                                    />
                                    <span className="truncate max-w-[80px]">{cluster.name}</span>
                                </button>
                            );
                        })}
                        {filteredClusters.length > 8 && (
                            <span className="text-slate-500">+{filteredClusters.length - 8} more</span>
                        )}
                    </>
                ) : (
                    <>
                        <span className="text-slate-500">Coupling:</span>
                        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500"></span>
                        <span>80%+</span>
                        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-orange-500"></span>
                        <span>60-80%</span>
                        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-yellow-400"></span>
                        <span>40-60%</span>
                        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500"></span>
                        <span>20-40%</span>
                        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-sky-400"></span>
                        <span>&lt;20%</span>
                    </>
                )}
            </div>

            {/* 3D Canvas */}
            <div
                id="city-canvas"
                className="h-[70vh] border border-slate-800 rounded-2xl overflow-hidden bg-slate-950"
            >
                <Canvas
                    shadows
                    gl={{ preserveDrawingBuffer: true }}
                    camera={{ position: [gridSize * 0.8, gridSize * 0.5, gridSize * 0.8], fov: 50 }}
                >
                    <CityScene
                        buildings={buildings}
                        districts={districts}
                        hoveredBuilding={hoveredBuilding}
                        setHoveredBuilding={setHoveredBuilding}
                        onBuildingClick={handleBuildingClick}
                        selectedCluster={selectedCluster}
                        hideUnselected={hideUnselected}
                        showFolderLabels={showFolderLabels}
                        showFileLabels={showFileLabels}
                        gridSize={gridSize}
                    />
                </Canvas>
            </div>

            {/* Tooltip */}
            {hoveredBuilding && (
                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl px-4 py-3 shadow-xl z-50">
                    <div className="text-sm font-medium text-slate-100">{hoveredBuilding.label}</div>
                    <div className="text-xs text-slate-400 mt-1 max-w-xs truncate">
                        <span className="text-slate-500">Path:</span> {hoveredBuilding.fullPath}
                    </div>
                    <div className="text-xs text-slate-400">
                        <span className="text-slate-500">Folder:</span> {hoveredBuilding.folder || 'root'}
                    </div>
                    <div className="text-xs text-slate-400">
                        <span className="text-slate-500">Coupling:</span> {Math.round(hoveredBuilding.coupling * 100)}%
                    </div>
                    {hoveredBuilding.clusterId !== null && (
                        <div className="text-xs text-slate-400">
                            <span className="text-slate-500">Cluster:</span>{' '}
                            <span
                                className="inline-block w-2 h-2 rounded-sm mr-1"
                                style={{ backgroundColor: hoveredBuilding.color }}
                            />
                            {filteredClusters.find(c => c.id === hoveredBuilding.clusterId)?.name || `Cluster ${hoveredBuilding.clusterId}`}
                        </div>
                    )}
                </div>
            )}

            {/* Instructions */}
            <div className="text-xs text-slate-500 text-center">
                Drag to rotate • Scroll to zoom • Right-click drag to pan • Click building to select cluster • Hover for file details
            </div>
        </div>
    );
}
