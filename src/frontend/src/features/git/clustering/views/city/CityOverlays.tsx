/**
 * Advanced UI Overlays for ProjectCity
 * 
 * Contains:
 * - Enhanced control panel with view mode switcher
 * - Camera preset buttons
 * - Minimap navigator
 * - Building info panel with detailed stats
 * - Feature toggle buttons (grid, beams, heatmap, particles)
 * - City stats bar
 * - Legend panel
 */

import React, { memo, useRef, useEffect, useState } from 'react';
import {
    Settings, Info, Box, Layers, RotateCcw, Eye, EyeOff,
    Maximize2, Minimize2, Palette, Grid3X3, Zap, Flame,
    Sparkles, Camera, Building2, Map, MonitorSmartphone,
    Glasses, Lightbulb, Network, Mountain, ArrowDown,
    ArrowUp, ChevronDown, Folder
} from 'lucide-react';
import type { BuildingData, DistrictData } from '../../types/index';
import { CouplingLegend } from '../../ui';
import { formatPercent } from '../../utils';
import type { CityViewMode, CameraPreset } from './CityScene';

// ============================================================
// View Mode Switcher
// ============================================================

interface ViewModeSwitcherProps {
    viewMode: CityViewMode;
    onViewModeChange: (mode: CityViewMode) => void;
}

const VIEW_MODES: Array<{ id: CityViewMode; label: string; icon: React.ReactNode; desc: string }> = [
    { id: 'standard', label: 'Standard', icon: <Building2 size={14} />, desc: 'Classic city with shadows' },
    { id: 'glass', label: 'Glass', icon: <Glasses size={14} />, desc: 'Transparent reflective buildings' },
    { id: 'neon', label: 'Neon', icon: <Lightbulb size={14} />, desc: 'Cyberpunk glow effects' },
    { id: 'minimal', label: 'Minimal', icon: <MonitorSmartphone size={14} />, desc: 'Clean flat rendering' },
];

export const ViewModeSwitcher = memo(function ViewModeSwitcher({
    viewMode,
    onViewModeChange
}: ViewModeSwitcherProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-700/80 hover:bg-slate-600 rounded-lg text-sm text-white transition-all border border-slate-600"
            >
                {VIEW_MODES.find(m => m.id === viewMode)?.icon}
                <span className="font-medium">{VIEW_MODES.find(m => m.id === viewMode)?.label}</span>
                <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full mt-1 left-0 z-50 bg-slate-800 rounded-lg border border-slate-700 shadow-2xl overflow-hidden min-w-52">
                        {VIEW_MODES.map(mode => (
                            <button
                                key={mode.id}
                                onClick={() => { onViewModeChange(mode.id); setIsOpen(false); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${viewMode === mode.id
                                    ? 'bg-blue-600/30 text-blue-300'
                                    : 'text-slate-300 hover:bg-slate-700'
                                    }`}
                            >
                                <div className={`${viewMode === mode.id ? 'text-blue-400' : 'text-slate-400'}`}>
                                    {mode.icon}
                                </div>
                                <div>
                                    <div className="font-medium">{mode.label}</div>
                                    <div className="text-xs text-slate-500">{mode.desc}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
});

// ============================================================
// Camera Preset Buttons
// ============================================================

interface CameraPresetsProps {
    current: CameraPreset;
    onChange: (preset: CameraPreset) => void;
}

const CAMERA_PRESETS: Array<{ id: CameraPreset; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <Mountain size={12} /> },
    { id: 'top-down', label: 'Top Down', icon: <ArrowDown size={12} /> },
    { id: 'street-level', label: 'Street', icon: <Building2 size={12} /> },
    { id: 'isometric', label: 'Isometric', icon: <Grid3X3 size={12} /> },
    { id: 'cinematic', label: 'Cinematic', icon: <Camera size={12} /> },
];

export const CameraPresets = memo(function CameraPresets({
    current, onChange
}: CameraPresetsProps) {
    return (
        <div className="flex gap-1">
            {CAMERA_PRESETS.map(preset => (
                <button
                    key={preset.id}
                    onClick={() => onChange(preset.id)}
                    title={preset.label}
                    className={`p-1.5 rounded text-xs transition-all ${current === preset.id
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'bg-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-600'
                        }`}
                >
                    {preset.icon}
                </button>
            ))}
        </div>
    );
});

// ============================================================
// Feature Toggle Buttons
// ============================================================

interface FeatureTogglesProps {
    showGrid: boolean;
    onShowGridChange: (v: boolean) => void;
    showBeams: boolean;
    onShowBeamsChange: (v: boolean) => void;
    showHeatmap: boolean;
    onShowHeatmapChange: (v: boolean) => void;
    showParticles: boolean;
    onShowParticlesChange: (v: boolean) => void;
}

export const FeatureToggles = memo(function FeatureToggles({
    showGrid, onShowGridChange,
    showBeams, onShowBeamsChange,
    showHeatmap, onShowHeatmapChange,
    showParticles, onShowParticlesChange
}: FeatureTogglesProps) {
    const toggles = [
        { label: 'Grid', icon: <Grid3X3 size={13} />, active: showGrid, onChange: onShowGridChange },
        { label: 'Beams', icon: <Network size={13} />, active: showBeams, onChange: onShowBeamsChange },
        { label: 'Heat', icon: <Flame size={13} />, active: showHeatmap, onChange: onShowHeatmapChange },
        { label: 'Dust', icon: <Sparkles size={13} />, active: showParticles, onChange: onShowParticlesChange },
    ];

    return (
        <div className="flex gap-1 flex-wrap">
            {toggles.map(t => (
                <button
                    key={t.label}
                    onClick={() => t.onChange(!t.active)}
                    title={t.label}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all ${t.active
                        ? 'bg-blue-600/80 text-white shadow shadow-blue-600/20'
                        : 'bg-slate-700/50 text-slate-500 hover:text-slate-300 hover:bg-slate-700'
                        }`}
                >
                    {t.icon}
                    {t.label}
                </button>
            ))}
        </div>
    );
});

// ============================================================
// Building Info Panel (Enhanced)
// ============================================================

interface BuildingInfoPanelProps {
    building: BuildingData | null;
    onClose?: () => void;
}

export const BuildingInfoPanel = memo(function BuildingInfoPanel({
    building,
    onClose
}: BuildingInfoPanelProps) {
    if (!building) return null;

    const couplingLevel = building.coupling >= 0.7 ? 'High' : building.coupling >= 0.4 ? 'Medium' : 'Low';
    const couplingColor = building.coupling >= 0.7 ? '#f87171' : building.coupling >= 0.4 ? '#fbbf24' : '#4ade80';

    return (
        <div className="absolute top-4 right-4 bg-slate-900/95 backdrop-blur-sm rounded-xl p-4 min-w-72 max-w-80 shadow-2xl border border-slate-700/80 animate-in slide-in-from-right-2">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: building.color }} />
                    <h3 className="font-semibold text-white truncate flex-1 text-sm" title={building.label}>
                        {building.label}
                    </h3>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors p-1 -mr-1 -mt-1 rounded hover:bg-slate-700"
                    >
                        ×
                    </button>
                )}
            </div>

            {/* Path */}
            <div className="flex items-center gap-1.5 mb-3 text-xs text-slate-400">
                <Folder size={11} />
                <span className="truncate" title={building.fullPath}>{building.fullPath}</span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 mb-3">
                <StatBadge
                    label="Folder"
                    value={building.folder || 'root'}
                    icon={<Folder size={11} />}
                />
                {building.clusterId !== undefined && building.clusterId !== null && (
                    <StatBadge
                        label="Cluster"
                        value={`#${building.clusterId}`}
                        icon={<Layers size={11} />}
                    />
                )}
                {building.coupling !== undefined && (
                    <StatBadge
                        label="Coupling"
                        value={formatPercent(building.coupling)}
                        icon={<Zap size={11} />}
                        color={couplingColor}
                    />
                )}
                <StatBadge
                    label="Height"
                    value={building.height.toFixed(1)}
                    icon={<ArrowUp size={11} />}
                />
            </div>

            {/* Coupling bar */}
            {building.coupling !== undefined && (
                <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>Coupling Strength</span>
                        <span style={{ color: couplingColor }}>{couplingLevel}</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${Math.max(2, building.coupling * 100)}%`,
                                backgroundColor: couplingColor
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
});

interface StatBadgeProps {
    label: string;
    value: string;
    icon: React.ReactNode;
    color?: string;
}

const StatBadge = memo(function StatBadge({ label, value, icon, color }: StatBadgeProps) {
    return (
        <div className="bg-slate-800/80 rounded-lg px-2.5 py-2 border border-slate-700/50">
            <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5">
                {icon}
                {label}
            </div>
            <div
                className="text-xs font-medium truncate"
                style={{ color: color || '#e2e8f0' }}
                title={value}
            >
                {value}
            </div>
        </div>
    );
});

// ============================================================
// City Controls Panel (Enhanced)
// ============================================================

interface CityControlsProps {
    colorBy: 'cluster' | 'coupling';
    showLabels: boolean;
    onShowLabelsChange: (value: boolean) => void;
    autoRotate: boolean;
    onAutoRotateChange: (value: boolean) => void;
    heightScale: number;
    onHeightScaleChange: (value: number) => void;
    maxDepth: number;
    onMaxDepthChange: (value: number) => void;
    onReset?: () => void;
    isFullscreen?: boolean;
    onToggleFullscreen?: () => void;
    onOpenSettings?: () => void;
    viewMode?: CityViewMode;
    onViewModeChange?: (mode: CityViewMode) => void;
    showGrid?: boolean;
    onShowGridChange?: (v: boolean) => void;
    showBeams?: boolean;
    onShowBeamsChange?: (v: boolean) => void;
    showHeatmap?: boolean;
    onShowHeatmapChange?: (v: boolean) => void;
    showParticles?: boolean;
    onShowParticlesChange?: (v: boolean) => void;
    cameraPreset?: CameraPreset;
    onCameraPresetChange?: (preset: CameraPreset) => void;
}

export const CityControls = memo(function CityControls({
    colorBy,
    showLabels,
    onShowLabelsChange,
    autoRotate,
    onAutoRotateChange,
    heightScale,
    onHeightScaleChange,
    maxDepth,
    onMaxDepthChange,
    onReset,
    isFullscreen,
    onToggleFullscreen,
    onOpenSettings,
    viewMode = 'standard',
    onViewModeChange,
    showGrid = false,
    onShowGridChange,
    showBeams = false,
    onShowBeamsChange,
    showHeatmap = false,
    onShowHeatmapChange,
    showParticles = true,
    onShowParticlesChange,
    cameraPreset = 'overview',
    onCameraPresetChange
}: CityControlsProps) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className={`absolute top-4 left-4 bg-slate-900/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-700/80 transition-all ${collapsed ? 'w-auto' : 'min-w-56'}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-slate-700/50">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex items-center gap-2 text-white hover:text-blue-300 transition-colors"
                >
                    <Settings size={14} />
                    {!collapsed && <span className="font-semibold text-xs">City Controls</span>}
                </button>
                <div className="flex gap-1">
                    {onOpenSettings && (
                        <button
                            onClick={onOpenSettings}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                            title="Color Settings"
                        >
                            <Palette size={14} />
                        </button>
                    )}
                    {onToggleFullscreen && (
                        <button
                            onClick={onToggleFullscreen}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        >
                            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        </button>
                    )}
                </div>
            </div>

            {/* Body */}
            {!collapsed && (
                <div className="p-3 space-y-3">
                    {/* View Mode Switcher */}
                    {onViewModeChange && (
                        <div>
                            <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 block">View Style</label>
                            <ViewModeSwitcher viewMode={viewMode} onViewModeChange={onViewModeChange} />
                        </div>
                    )}

                    {/* Color mode indicator */}
                    <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/60 rounded-lg px-2.5 py-2">
                        {colorBy === 'cluster' ? <Layers size={12} /> : <Box size={12} />}
                        <span>Colored by <strong className="text-slate-200">{colorBy}</strong></span>
                    </div>

                    {/* Feature Toggles */}
                    {onShowGridChange && onShowBeamsChange && onShowHeatmapChange && onShowParticlesChange && (
                        <div>
                            <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 block">Features</label>
                            <FeatureToggles
                                showGrid={showGrid}
                                onShowGridChange={onShowGridChange}
                                showBeams={showBeams}
                                onShowBeamsChange={onShowBeamsChange}
                                showHeatmap={showHeatmap}
                                onShowHeatmapChange={onShowHeatmapChange}
                                showParticles={showParticles}
                                onShowParticlesChange={onShowParticlesChange}
                            />
                        </div>
                    )}

                    {/* Height Scale */}
                    <ControlGroup label="Building Height">
                        <input
                            type="range"
                            min="0.5"
                            max="3"
                            step="0.1"
                            value={heightScale}
                            onChange={(e) => onHeightScaleChange(parseFloat(e.target.value))}
                            className="w-full accent-blue-500 h-1.5"
                        />
                        <span className="text-[10px] text-slate-500">{heightScale.toFixed(1)}x</span>
                    </ControlGroup>

                    {/* Folder Depth */}
                    <ControlGroup label="Folder Depth">
                        <input
                            type="range"
                            min="1"
                            max="10"
                            step="1"
                            value={maxDepth}
                            onChange={(e) => onMaxDepthChange(parseInt(e.target.value))}
                            className="w-full accent-blue-500 h-1.5"
                        />
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-500">
                                {maxDepth >= 10 ? 'All levels' : `${maxDepth} level${maxDepth > 1 ? 's' : ''}`}
                            </span>
                        </div>
                    </ControlGroup>

                    {/* Camera Presets */}
                    {onCameraPresetChange && (
                        <div>
                            <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 block">Camera</label>
                            <CameraPresets current={cameraPreset} onChange={onCameraPresetChange} />
                        </div>
                    )}

                    {/* Quick Toggles */}
                    <div className="flex gap-1.5">
                        <button
                            onClick={() => onShowLabelsChange(!showLabels)}
                            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all
                                ${showLabels
                                    ? 'bg-blue-600/80 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                        >
                            {showLabels ? <Eye size={12} /> : <EyeOff size={12} />}
                            Labels
                        </button>
                        <button
                            onClick={() => onAutoRotateChange(!autoRotate)}
                            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all
                                ${autoRotate
                                    ? 'bg-blue-600/80 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                        >
                            <RotateCcw size={12} />
                            Rotate
                        </button>
                    </div>

                    {/* Reset */}
                    {onReset && (
                        <button
                            onClick={onReset}
                            className="w-full px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-[11px] font-medium transition-all"
                        >
                            Reset All
                        </button>
                    )}
                </div>
            )}
        </div>
    );
});

interface ControlGroupProps {
    label: string;
    children: React.ReactNode;
}

const ControlGroup = memo(function ControlGroup({ label, children }: ControlGroupProps) {
    return (
        <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">{label}</label>
            {children}
        </div>
    );
});

// ============================================================
// Minimap Navigator
// ============================================================

interface MinimapProps {
    buildings: BuildingData[];
    districts: DistrictData[];
    cityWidth: number;
    cityHeight: number;
    selectedPath?: string | null;
}

export const Minimap = memo(function Minimap({
    buildings,
    districts,
    cityWidth,
    cityHeight,
    selectedPath
}: MinimapProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const MAP_SIZE = 140;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = MAP_SIZE * dpr;
        canvas.height = MAP_SIZE * dpr;
        ctx.scale(dpr, dpr);

        const scaleX = MAP_SIZE / cityWidth;
        const scaleY = MAP_SIZE / cityHeight;

        // Background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

        // Districts
        districts.forEach(d => {
            ctx.fillStyle = `rgba(100, 116, 139, 0.15)`;
            ctx.fillRect(d.x * scaleX, d.z * scaleY, d.width * scaleX, d.depth * scaleY);
            ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(d.x * scaleX, d.z * scaleY, d.width * scaleX, d.depth * scaleY);
        });

        // Buildings
        buildings.forEach(b => {
            const isSelected = b.fullPath === selectedPath;
            ctx.fillStyle = isSelected ? '#fbbf24' : b.color;
            const size = Math.max(1.5, Math.min(b.width * scaleX, 4));
            ctx.fillRect(
                b.x * scaleX - size / 2,
                b.z * scaleY - size / 2,
                size,
                size
            );
        });

        // Border
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, MAP_SIZE, MAP_SIZE);

    }, [buildings, districts, cityWidth, cityHeight, selectedPath]);

    return (
        <div className="absolute bottom-16 right-4 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700/80 shadow-xl overflow-hidden">
            <div className="px-2 py-1 text-[9px] text-slate-500 uppercase tracking-wider border-b border-slate-700/50 flex items-center gap-1">
                <Map size={9} />
                Minimap
            </div>
            <canvas
                ref={canvasRef}
                style={{ width: MAP_SIZE, height: MAP_SIZE }}
                className="block"
            />
        </div>
    );
});

// ============================================================
// City Stats Panel (Enhanced)
// ============================================================

interface CityStatsProps {
    buildingCount: number;
    districtCount: number;
    clusterCount: number;
    viewMode?: CityViewMode;
}

export const CityStats = memo(function CityStats({
    buildingCount,
    districtCount,
    clusterCount,
    viewMode
}: CityStatsProps) {
    return (
        <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-sm rounded-lg px-3 py-2 flex gap-4 text-xs shadow-xl border border-slate-700/80">
            <StatItem icon={<Box size={12} />} label="Files" value={buildingCount} />
            <StatItem icon={<Layers size={12} />} label="Folders" value={districtCount} />
            <StatItem icon={<Info size={12} />} label="Clusters" value={clusterCount} />
            {viewMode && (
                <div className="flex items-center gap-1.5 text-slate-500 border-l border-slate-700 pl-4">
                    <span className="capitalize text-[10px]">{viewMode}</span>
                </div>
            )}
        </div>
    );
});

interface StatItemProps {
    icon: React.ReactNode;
    label: string;
    value: number;
}

const StatItem = memo(function StatItem({ icon, label, value }: StatItemProps) {
    return (
        <div className="flex items-center gap-1.5 text-slate-300">
            <span className="text-slate-500">{icon}</span>
            <span className="text-slate-500">{label}:</span>
            <span className="font-semibold text-white">{value.toLocaleString()}</span>
        </div>
    );
});

// ============================================================
// Legend Panel
// ============================================================

interface CityLegendProps {
    colorBy: 'cluster' | 'coupling';
    clusterColors?: Array<{ color: string; name: string }>;
}

export const CityLegend = memo(function CityLegend({
    colorBy,
    clusterColors = []
}: CityLegendProps) {
    const [expanded, setExpanded] = useState(false);

    if (colorBy === 'coupling') {
        return (
            <div className="absolute bottom-4 right-4">
                <CouplingLegend />
            </div>
        );
    }

    if (clusterColors.length === 0) return null;

    const visible = expanded ? clusterColors : clusterColors.slice(0, 8);

    return (
        <div className="absolute bottom-4 right-4 bg-slate-900/90 backdrop-blur-sm rounded-lg p-3 max-w-xs shadow-xl border border-slate-700/80">
            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-2">
                <span className="uppercase tracking-wider">Cluster Colors</span>
                {clusterColors.length > 8 && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="text-blue-400 hover:text-blue-300"
                    >
                        {expanded ? 'Less' : `+${clusterColors.length - 8} more`}
                    </button>
                )}
            </div>
            <div className="flex flex-wrap gap-1.5">
                {visible.map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-slate-800/50 rounded px-1.5 py-0.5">
                        <div
                            className="w-2.5 h-2.5 rounded-sm"
                            style={{ backgroundColor: item.color }}
                        />
                        <span className="text-[10px] text-slate-300 truncate max-w-20">
                            {item.name}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
});
