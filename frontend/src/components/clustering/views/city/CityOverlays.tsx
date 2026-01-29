/**
 * UI Overlays for ProjectCity
 * 
 * Contains control panels, info panels, and legends.
 */

import React, { memo } from 'react';
import { Settings, Info, Box, Layers, RotateCcw, Eye, EyeOff, Maximize2, Minimize2, Palette } from 'lucide-react';
import type { BuildingData } from '../../types/index';
import { CouplingLegend } from '../../ui';
import { formatPercent } from '../../utils';

// ============================================================
// Building Info Panel
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

    return (
        <div className="absolute top-4 right-4 bg-slate-800/95 rounded-lg p-4 min-w-64 max-w-80 shadow-xl border border-slate-700">
            <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="font-semibold text-white truncate flex-1" title={building.label}>
                    {building.label}
                </h3>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors p-1 -mr-1 -mt-1"
                    >
                        ×
                    </button>
                )}
            </div>

            <div className="space-y-2 text-sm">
                <InfoRow label="Path" value={building.fullPath} truncate />
                <InfoRow label="Folder" value={building.folder || 'root'} />
                {building.coupling !== undefined && (
                    <InfoRow
                        label="Coupling"
                        value={formatPercent(building.coupling)}
                        valueColor={getCouplingTextColor(building.coupling)}
                    />
                )}
                {building.clusterId !== undefined && (
                    <InfoRow label="Cluster" value={`#${building.clusterId}`} />
                )}
            </div>
        </div>
    );
});

interface InfoRowProps {
    label: string;
    value: string;
    truncate?: boolean;
    valueColor?: string;
}

const InfoRow = memo(function InfoRow({
    label,
    value,
    truncate = false,
    valueColor
}: InfoRowProps) {
    return (
        <div className="flex gap-2">
            <span className="text-slate-400 shrink-0">{label}:</span>
            <span
                className={`text-slate-200 ${truncate ? 'truncate' : ''}`}
                style={valueColor ? { color: valueColor } : undefined}
                title={truncate ? value : undefined}
            >
                {value}
            </span>
        </div>
    );
});

function getCouplingTextColor(coupling: number): string {
    if (coupling >= 0.7) return '#f87171';
    if (coupling >= 0.4) return '#fbbf24';
    return '#4ade80';
}

// ============================================================
// City Controls Panel
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
    onOpenSettings
}: CityControlsProps) {
    return (
        <div className="absolute top-4 left-4 bg-slate-800/95 rounded-lg p-4 min-w-52 shadow-xl border border-slate-700">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-white">
                    <Settings size={16} />
                    <span className="font-semibold text-sm">3D Settings</span>
                </div>
                <div className="flex gap-1">
                    {onOpenSettings && (
                        <button
                            onClick={onOpenSettings}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                            title="Color Settings"
                        >
                            <Palette size={16} />
                        </button>
                    )}
                    {onToggleFullscreen && (
                        <button
                            onClick={onToggleFullscreen}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        >
                            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                {/* Color mode indicator */}
                <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-700/50 rounded px-2 py-1.5">
                    {colorBy === 'cluster' ? <Layers size={12} /> : <Box size={12} />}
                    <span>Colored by {colorBy}</span>
                </div>

                {/* Height Scale */}
                <ControlGroup label="Building Height">
                    <input
                        type="range"
                        min="0.5"
                        max="3"
                        step="0.1"
                        value={heightScale}
                        onChange={(e) => onHeightScaleChange(parseFloat(e.target.value))}
                        className="w-full accent-blue-500"
                    />
                    <span className="text-xs text-slate-400">{heightScale.toFixed(1)}x</span>
                </ControlGroup>

                {/* Folder Depth */}
                <ControlGroup label="Folder Depth">
                    <input
                        type="range"
                        min="1"
                        max="6"
                        step="1"
                        value={maxDepth}
                        onChange={(e) => onMaxDepthChange(parseInt(e.target.value))}
                        className="w-full accent-blue-500"
                    />
                    <span className="text-xs text-slate-400">{maxDepth} levels</span>
                </ControlGroup>

                {/* Toggles */}
                <div className="flex gap-2">
                    <button
                        onClick={() => onShowLabelsChange(!showLabels)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors
                            ${showLabels
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                    >
                        {showLabels ? <Eye size={14} /> : <EyeOff size={14} />}
                        Labels
                    </button>
                    <button
                        onClick={() => onAutoRotateChange(!autoRotate)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors
                            ${autoRotate
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                    >
                        <RotateCcw size={14} />
                        Rotate
                    </button>
                </div>

                {/* Reset */}
                {onReset && (
                    <button
                        onClick={onReset}
                        className="w-full px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-sm transition-colors"
                    >
                        Reset View
                    </button>
                )}
            </div>
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
            <label className="text-xs text-slate-400 mb-1 block">{label}</label>
            {children}
        </div>
    );
});

// ============================================================
// City Stats Panel
// ============================================================

interface CityStatsProps {
    buildingCount: number;
    districtCount: number;
    clusterCount: number;
}

export const CityStats = memo(function CityStats({
    buildingCount,
    districtCount,
    clusterCount
}: CityStatsProps) {
    return (
        <div className="absolute bottom-4 left-4 bg-slate-800/90 rounded-lg px-4 py-2 flex gap-6 text-sm shadow-lg border border-slate-700">
            <StatItem icon={<Box size={14} />} label="Files" value={buildingCount} />
            <StatItem icon={<Layers size={14} />} label="Folders" value={districtCount} />
            <StatItem icon={<Info size={14} />} label="Clusters" value={clusterCount} />
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
        <div className="flex items-center gap-2 text-slate-300">
            {icon}
            <span>{label}:</span>
            <span className="font-semibold text-white">{value}</span>
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
    if (colorBy === 'coupling') {
        return (
            <div className="absolute bottom-4 right-4">
                <CouplingLegend />
            </div>
        );
    }

    if (clusterColors.length === 0) return null;

    return (
        <div className="absolute bottom-4 right-4 bg-slate-800/90 rounded-lg p-3 max-w-xs shadow-lg border border-slate-700">
            <div className="text-xs text-slate-400 mb-2">Cluster Colors</div>
            <div className="flex flex-wrap gap-2">
                {clusterColors.slice(0, 10).map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                        <div
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: item.color }}
                        />
                        <span className="text-xs text-slate-300 truncate max-w-20">
                            {item.name}
                        </span>
                    </div>
                ))}
                {clusterColors.length > 10 && (
                    <span className="text-xs text-slate-500">
                        +{clusterColors.length - 10} more
                    </span>
                )}
            </div>
        </div>
    );
});
