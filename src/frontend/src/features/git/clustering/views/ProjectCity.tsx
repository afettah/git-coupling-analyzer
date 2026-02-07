/**
 * ProjectCity Component (Advanced)
 * 
 * A full-featured 3D city visualization where:
 * - Buildings represent files (height = LOC/complexity)
 * - Districts represent folders (treemap layout)
 * - Colors indicate clusters or coupling strength
 * - Multiple view modes: Standard, Glass, Neon, Minimal
 * - Feature toggles: Grid, Beams, Heatmap, Particles
 * - Minimap navigator for large projects
 * - Camera presets for different perspectives
 * - Collapsible control panel
 * 
 * Now receives filtered clusters from parent and shares filter bar.
 */

import { useState, useMemo, useCallback, memo, useRef, useEffect } from 'react';
import type { ClusterResult } from '@/api/git';
import type { BuildingData, DistrictData, FileData, ClusterData } from '../types/index';
import { CITY_CONFIG } from '../constants';
import { CityScene, type CityViewMode, type CameraPreset } from './city/CityScene';
import { CityControls, CityStats, CityLegend, BuildingInfoPanel, Minimap } from './city/CityOverlays';
import { CitySettingsModal } from './city/CitySettingsModal';
import { buildFolderTree, layoutTreemap, collectBuildings, collectDistricts } from './city/treemap';
import { useCitySettings } from '../hooks';

// ============================================================
// Props
// ============================================================

interface ProjectCityProps {
    result: ClusterResult;
    filteredClusters: ClusterData[];
    colorBy: 'cluster' | 'coupling';
    clusterId?: number | null;
}

// ============================================================
// Data Processing
// ============================================================

type ClusterType = ClusterResult['clusters'][number];

function processClusterData(
    result: ClusterResult,
    filteredClusters: ClusterData[],
    clusterId?: number | null
): { files: FileData[]; clusterIndexMap: Map<number, number> } {
    const clusterIndexMap = new Map<number, number>();
    result.clusters.forEach((cluster: ClusterType, index: number) => {
        clusterIndexMap.set(cluster.id, index);
    });

    // Build coupling map from cluster-level avg_coupling (fallback since top_coupled_files may not exist)
    const fileCouplingMap = new Map<string, number>();
    result.clusters.forEach((cluster: ClusterType) => {
        const avgCoupling = cluster.avg_coupling || 0;
        cluster.files.forEach((file: string) => {
            fileCouplingMap.set(file, avgCoupling);
        });
    });

    const fileClusterMap = new Map<string, number>();
    result.clusters.forEach((cluster: ClusterType) => {
        cluster.files.forEach((file: string) => {
            fileClusterMap.set(file, cluster.id);
        });
    });

    // Get files from filtered clusters (respects shared filter state)
    const filteredClusterIds = new Set(filteredClusters.map(c => c.id));

    let files: string[];
    if (clusterId !== undefined && clusterId !== null) {
        const cluster = result.clusters.find((c: ClusterType) => c.id === clusterId);
        files = cluster ? cluster.files : [];
    } else {
        // Only include files from filtered clusters
        files = result.clusters
            .filter((c: ClusterType) => filteredClusterIds.has(c.id))
            .flatMap((c: ClusterType) => c.files);
    }

    const fileData: FileData[] = files.map(path => ({
        path,
        filename: path.split('/').pop() || path,
        coupling: fileCouplingMap.get(path) || 0,
        clusterId: fileClusterMap.get(path) ?? null,
        clusterIndex: fileClusterMap.has(path)
            ? clusterIndexMap.get(fileClusterMap.get(path)!) ?? null
            : null,
        loc: Math.floor(Math.random() * 500 + 50) // Placeholder - would come from actual LOC data
    }));

    return { files: fileData, clusterIndexMap };
}

// ============================================================
// Main Component
// ============================================================

export const ProjectCity = memo(function ProjectCity({
    result,
    filteredClusters,
    colorBy,
    clusterId
}: ProjectCityProps) {
    // Container ref for fullscreen
    const containerRef = useRef<HTMLDivElement>(null);

    // City settings with localStorage persistence
    const {
        settings,
        updateColorSettings,
        resetToDefaults,
        availablePalettes
    } = useCitySettings();

    // View state (colorBy now comes from parent)
    const [showLabels, setShowLabels] = useState(true);
    const [autoRotate, setAutoRotate] = useState(false);
    const [heightScale, setHeightScale] = useState<number>(CITY_CONFIG.heightScaleFactor);
    const [maxDepth, setMaxDepth] = useState<number>(CITY_CONFIG.maxDepth);

    // Advanced view features
    const [viewMode, setViewMode] = useState<CityViewMode>('standard');
    const [showGrid, setShowGrid] = useState(false);
    const [showBeams, setShowBeams] = useState(false);
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [showParticles, setShowParticles] = useState(true);
    const [showMinimap, setShowMinimap] = useState(true);
    const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');

    // UI state
    const [selectedBuilding, setSelectedBuilding] = useState<BuildingData | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Fullscreen handling
    const handleToggleFullscreen = useCallback(async () => {
        if (!containerRef.current) return;

        try {
            if (!document.fullscreenElement) {
                await containerRef.current.requestFullscreen();
                setIsFullscreen(true);
            } else {
                await document.exitFullscreen();
                setIsFullscreen(false);
            }
        } catch (error) {
            console.error('Fullscreen error:', error);
        }
    }, []);

    // Listen for fullscreen changes (e.g., Escape key)
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    // Process data (now uses filtered clusters)
    const { files, clusterIndexMap } = useMemo(
        () => processClusterData(result, filteredClusters, clusterId),
        [result, filteredClusters, clusterId]
    );

    // Build city layout - use custom palette from settings
    const { buildings, districts, cityWidth, cityHeight } = useMemo(() => {
        if (files.length === 0) {
            return { buildings: [], districts: [], cityWidth: 10, cityHeight: 10 };
        }

        const root = buildFolderTree(files);

        // Calculate city size based on file count
        const totalFiles = files.length;
        const citySize = Math.max(
            CITY_CONFIG.baseCitySize,
            Math.sqrt(totalFiles) * 3
        );

        layoutTreemap(
            root,
            0, 0,
            citySize, citySize,
            maxDepth,
            CITY_CONFIG.folderGap,
            CITY_CONFIG.labelMargin
        );

        const buildings: BuildingData[] = [];
        const districts: DistrictData[] = [];

        collectDistricts(root, districts, CITY_CONFIG.labelMargin);
        collectBuildings(
            root,
            buildings,
            clusterIndexMap,
            heightScale,
            CITY_CONFIG.labelMargin,
            colorBy,
            settings.colors.clusterPalette,
            settings.colors.unclusteredColor
        );

        return { buildings, districts, cityWidth: citySize, cityHeight: citySize };
    }, [files, clusterIndexMap, maxDepth, heightScale, colorBy, settings.colors.clusterPalette, settings.colors.unclusteredColor]);

    // Cluster colors for legend - use custom palette
    const clusterColors = useMemo(() => {
        const palette = settings.colors.clusterPalette;
        return result.clusters.map((cluster: ClusterType, index: number) => ({
            color: palette[index % palette.length],
            name: `Cluster ${cluster.id}`
        }));
    }, [result.clusters, settings.colors.clusterPalette]);

    // Handlers
    const handleSelectBuilding = useCallback((building: BuildingData) => {
        setSelectedBuilding((prev: BuildingData | null) =>
            prev?.fullPath === building.fullPath ? null : building
        );
    }, []);

    const handleClearSelection = useCallback(() => {
        setSelectedBuilding(null);
    }, []);

    const handleReset = useCallback(() => {
        setShowLabels(true);
        setAutoRotate(false);
        setHeightScale(CITY_CONFIG.heightScaleFactor);
        setMaxDepth(CITY_CONFIG.maxDepth);
        setSelectedBuilding(null);
        setViewMode('standard');
        setShowGrid(false);
        setShowBeams(false);
        setShowHeatmap(false);
        setShowParticles(true);
        setCameraPreset('overview');
    }, []);

    const handleOpenSettings = useCallback(() => {
        setIsSettingsOpen(true);
    }, []);

    const handleCloseSettings = useCallback(() => {
        setIsSettingsOpen(false);
    }, []);

    // Empty state
    if (files.length === 0) {
        return (
            <div className="h-[70vh] min-h-[500px] flex items-center justify-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-400">
                <div className="text-center">
                    <p className="text-lg mb-2">No files to visualize</p>
                    <p className="text-sm">Adjust the filters or ensure the analysis has files.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* 3D Canvas Container with proper layout */}
            <div
                ref={containerRef}
                className={`relative h-[75vh] min-h-[550px] border border-slate-800 rounded-2xl overflow-hidden ${isFullscreen ? 'bg-slate-900' : 'bg-slate-950'}`}
            >
                {/* 3D Scene */}
                <CityScene
                    buildings={buildings}
                    districts={districts}
                    cityWidth={cityWidth}
                    cityHeight={cityHeight}
                    selectedPath={selectedBuilding?.fullPath}
                    onSelectBuilding={handleSelectBuilding}
                    showLabels={showLabels}
                    autoRotate={autoRotate}
                    colorSettings={settings.colors}
                    viewMode={viewMode}
                    showGrid={showGrid}
                    showBeams={showBeams}
                    showHeatmap={showHeatmap}
                    showParticles={showParticles}
                    cameraPreset={cameraPreset}
                />

                {/* Controls Panel */}
                <CityControls
                    colorBy={colorBy}
                    showLabels={showLabels}
                    onShowLabelsChange={setShowLabels}
                    autoRotate={autoRotate}
                    onAutoRotateChange={setAutoRotate}
                    heightScale={heightScale}
                    onHeightScaleChange={setHeightScale}
                    maxDepth={maxDepth}
                    onMaxDepthChange={setMaxDepth}
                    onReset={handleReset}
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={handleToggleFullscreen}
                    onOpenSettings={handleOpenSettings}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    showGrid={showGrid}
                    onShowGridChange={setShowGrid}
                    showBeams={showBeams}
                    onShowBeamsChange={setShowBeams}
                    showHeatmap={showHeatmap}
                    onShowHeatmapChange={setShowHeatmap}
                    showParticles={showParticles}
                    onShowParticlesChange={setShowParticles}
                    cameraPreset={cameraPreset}
                    onCameraPresetChange={setCameraPreset}
                />

                {/* Building Info Panel */}
                <BuildingInfoPanel
                    building={selectedBuilding}
                    onClose={handleClearSelection}
                />

                {/* Minimap */}
                {showMinimap && buildings.length > 20 && (
                    <Minimap
                        buildings={buildings}
                        districts={districts}
                        cityWidth={cityWidth}
                        cityHeight={cityHeight}
                        selectedPath={selectedBuilding?.fullPath}
                    />
                )}

                {/* Stats */}
                <CityStats
                    buildingCount={buildings.length}
                    districtCount={districts.length}
                    clusterCount={filteredClusters.length}
                    viewMode={viewMode}
                />

                {/* Legend */}
                {!showMinimap || buildings.length <= 20 ? (
                    <CityLegend
                        colorBy={colorBy}
                        clusterColors={clusterColors}
                    />
                ) : null}

                {/* Settings Modal */}
                <CitySettingsModal
                    isOpen={isSettingsOpen}
                    onClose={handleCloseSettings}
                    settings={settings.colors}
                    onUpdateSettings={updateColorSettings}
                    onResetToDefaults={resetToDefaults}
                    availablePalettes={availablePalettes}
                />
            </div>

            {/* Instructions & quick info */}
            <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                    Drag to rotate • Scroll to zoom • Click buildings to inspect • Use controls to customize
                </span>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowMinimap(!showMinimap)}
                        className={`transition-colors ${showMinimap ? 'text-blue-400' : 'text-slate-600 hover:text-slate-400'}`}
                    >
                        {showMinimap ? 'Hide Minimap' : 'Show Minimap'}
                    </button>
                </div>
            </div>
        </div>
    );
});

export default ProjectCity;
