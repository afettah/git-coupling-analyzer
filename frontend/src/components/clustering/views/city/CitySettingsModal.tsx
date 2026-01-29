/**
 * City Settings Modal
 * 
 * Modal for configuring city visualization settings (colors, palettes).
 */

import { memo, useState } from 'react';
import { X, Palette, RotateCcw, Check, FolderOpen, Building, Layers } from 'lucide-react';
import type { CityColorSettings, ColorPalette } from '../../hooks/useCitySettings';

// ============================================================
// Props
// ============================================================

interface CitySettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: CityColorSettings;
    onUpdateSettings: (updates: Partial<CityColorSettings>) => void;
    onResetToDefaults: () => void;
    availablePalettes: ColorPalette[];
}

// ============================================================
// Sub-Components
// ============================================================

interface ColorInputProps {
    label: string;
    color: string;
    onChange: (color: string) => void;
}

const ColorInput = memo(function ColorInput({
    label,
    color,
    onChange
}: ColorInputProps) {
    return (
        <div className="flex items-center gap-3">
            <label className="text-sm text-slate-300 w-32">{label}</label>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={color}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-slate-600"
                />
                <input
                    type="text"
                    value={color}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-24 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                    placeholder="#000000"
                />
            </div>
        </div>
    );
});

interface PalettePreviewProps {
    palette: ColorPalette;
    isSelected: boolean;
    onSelect: () => void;
}

const PalettePreview = memo(function PalettePreview({
    palette,
    isSelected,
    onSelect
}: PalettePreviewProps) {
    return (
        <button
            onClick={onSelect}
            className={`
                p-3 rounded-lg border-2 transition-all w-full text-left
                ${isSelected
                    ? 'border-blue-500 bg-slate-700'
                    : 'border-slate-600 bg-slate-800 hover:border-slate-500 hover:bg-slate-700'
                }
            `}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{palette.name}</span>
                {isSelected && <Check size={14} className="text-blue-400" />}
            </div>
            <div className="flex flex-wrap gap-1">
                {palette.colors.slice(0, 10).map((color, i) => (
                    <div
                        key={i}
                        className="w-4 h-4 rounded-sm"
                        style={{ backgroundColor: color }}
                    />
                ))}
                {palette.colors.length > 10 && (
                    <span className="text-xs text-slate-500 ml-1">
                        +{palette.colors.length - 10}
                    </span>
                )}
            </div>
        </button>
    );
});

interface SectionProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}

const Section = memo(function Section({ title, icon, children }: SectionProps) {
    return (
        <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                {icon}
                {title}
            </h4>
            {children}
        </div>
    );
});

// ============================================================
// Main Component
// ============================================================

export const CitySettingsModal = memo(function CitySettingsModal({
    isOpen,
    onClose,
    settings,
    onUpdateSettings,
    onResetToDefaults,
    availablePalettes
}: CitySettingsModalProps) {
    const [activeTab, setActiveTab] = useState<'palettes' | 'colors'>('palettes');

    if (!isOpen) return null;

    const currentPaletteName = availablePalettes.find(
        p => JSON.stringify(p.colors) === JSON.stringify(settings.clusterPalette)
    )?.name || 'Custom';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-lg max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                        <Palette size={20} className="text-blue-400" />
                        <h3 className="text-lg font-semibold text-white">Viewer Settings</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-700">
                    <button
                        onClick={() => setActiveTab('palettes')}
                        className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'palettes'
                            ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-700/50'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Layers size={14} />
                            Cluster Palettes
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('colors')}
                        className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'colors'
                            ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-700/50'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Palette size={14} />
                            Custom Colors
                        </div>
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[calc(80vh-180px)]">
                    {activeTab === 'palettes' ? (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-400">
                                Select a color palette for cluster visualization. Current:
                                <span className="text-white ml-1 font-medium">{currentPaletteName}</span>
                            </p>
                            <div className="grid gap-3">
                                {availablePalettes.map((palette) => (
                                    <PalettePreview
                                        key={palette.name}
                                        palette={palette}
                                        isSelected={JSON.stringify(palette.colors) === JSON.stringify(settings.clusterPalette)}
                                        onSelect={() => onUpdateSettings({ clusterPalette: palette.colors })}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Folder Colors */}
                            <Section title="Folder Colors (by depth)" icon={<FolderOpen size={16} />}>
                                <div className="flex gap-2 items-center flex-wrap">
                                    {settings.folderColors.map((color, i) => (
                                        <div key={i} className="flex flex-col items-center gap-1">
                                            <input
                                                type="color"
                                                value={color}
                                                onChange={(e) => {
                                                    const newColors = [...settings.folderColors];
                                                    newColors[i] = e.target.value;
                                                    onUpdateSettings({ folderColors: newColors });
                                                }}
                                                className="w-8 h-8 rounded cursor-pointer border border-slate-600"
                                            />
                                            <span className="text-xs text-slate-500">L{i}</span>
                                        </div>
                                    ))}
                                </div>
                            </Section>

                            {/* Building Colors */}
                            <Section title="Building Colors" icon={<Building size={16} />}>
                                <div className="space-y-3">
                                    <ColorInput
                                        label="Unclustered"
                                        color={settings.unclusteredColor}
                                        onChange={(color) => onUpdateSettings({ unclusteredColor: color })}
                                    />
                                    <ColorInput
                                        label="Selected"
                                        color={settings.selectedColor}
                                        onChange={(color) => onUpdateSettings({ selectedColor: color })}
                                    />
                                    <ColorInput
                                        label="Hovered"
                                        color={settings.hoveredColor}
                                        onChange={(color) => onUpdateSettings({ hoveredColor: color })}
                                    />
                                </div>
                            </Section>

                            {/* Ground Color */}
                            <Section title="Environment" icon={<Layers size={16} />}>
                                <ColorInput
                                    label="Ground"
                                    color={settings.groundColor}
                                    onChange={(color) => onUpdateSettings({ groundColor: color })}
                                />
                            </Section>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-slate-700 bg-slate-800/50">
                    <button
                        onClick={onResetToDefaults}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        <RotateCcw size={14} />
                        Reset to Defaults
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
});

export default CitySettingsModal;
