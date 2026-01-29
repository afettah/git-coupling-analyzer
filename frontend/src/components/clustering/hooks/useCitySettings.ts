/**
 * City Settings Hook
 * 
 * Manages city visualization settings with localStorage persistence.
 */

import { useState, useEffect, useCallback } from 'react';

// ============================================================
// Types
// ============================================================

export interface ColorPalette {
    name: string;
    colors: string[];
}

export interface CityColorSettings {
    clusterPalette: string[];
    folderColors: string[];
    unclusteredColor: string;
    groundColor: string;
    selectedColor: string;
    hoveredColor: string;
}

export interface CitySettings {
    colors: CityColorSettings;
    // Future extensibility for other settings
}

// ============================================================
// Default Values
// ============================================================

export const DEFAULT_CLUSTER_PALETTES: ColorPalette[] = [
    {
        name: 'Default',
        colors: [
            '#38bdf8', '#22c55e', '#f97316', '#e879f9', '#facc15',
            '#60a5fa', '#34d399', '#fb7185', '#a78bfa', '#fbbf24',
            '#2dd4bf', '#f472b6', '#818cf8', '#fb923c', '#4ade80',
            '#c084fc', '#fcd34d', '#67e8f9', '#f87171', '#a3e635'
        ]
    },
    {
        name: 'Ocean',
        colors: [
            '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e',
            '#0284c7', '#0891b2', '#0d9488', '#059669', '#16a34a',
            '#0369a1', '#0e7490', '#0f766e', '#047857', '#15803d',
            '#075985', '#155e75', '#115e59', '#065f46', '#166534'
        ]
    },
    {
        name: 'Sunset',
        colors: [
            '#f97316', '#f59e0b', '#eab308', '#ef4444', '#ec4899',
            '#ea580c', '#d97706', '#ca8a04', '#dc2626', '#db2777',
            '#c2410c', '#b45309', '#a16207', '#b91c1c', '#be185d',
            '#9a3412', '#92400e', '#854d0e', '#991b1b', '#9d174d'
        ]
    },
    {
        name: 'Forest',
        colors: [
            '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d',
            '#84cc16', '#65a30d', '#4d7c0f', '#3f6212', '#365314',
            '#10b981', '#059669', '#047857', '#065f46', '#064e3b',
            '#34d399', '#2dd4bf', '#14b8a6', '#0d9488', '#0f766e'
        ]
    },
    {
        name: 'Neon',
        colors: [
            '#f0abfc', '#e879f9', '#d946ef', '#c026d3', '#a21caf',
            '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca',
            '#67e8f9', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490',
            '#bef264', '#a3e635', '#84cc16', '#65a30d', '#4d7c0f'
        ]
    },
    {
        name: 'Monochrome',
        colors: [
            '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8',
            '#64748b', '#475569', '#334155', '#1e293b', '#0f172a',
            '#fafafa', '#f5f5f5', '#e5e5e5', '#d4d4d4', '#a3a3a3',
            '#737373', '#525252', '#404040', '#262626', '#171717'
        ]
    }
];

export const DEFAULT_FOLDER_COLORS = [
    '#1e293b', // Level 0 - darkest
    '#334155', // Level 1
    '#475569', // Level 2
    '#64748b', // Level 3
    '#94a3b8'  // Level 4 - lightest
];

export const DEFAULT_COLOR_SETTINGS: CityColorSettings = {
    clusterPalette: DEFAULT_CLUSTER_PALETTES[0].colors,
    folderColors: DEFAULT_FOLDER_COLORS,
    unclusteredColor: '#64748b',
    groundColor: '#1a1a2e',
    selectedColor: '#fbbf24',
    hoveredColor: '#60a5fa'
};

export const DEFAULT_CITY_SETTINGS: CitySettings = {
    colors: DEFAULT_COLOR_SETTINGS
};

// ============================================================
// Storage Keys
// ============================================================

const STORAGE_KEY = 'city-visualization-settings';

// ============================================================
// Hook Implementation
// ============================================================

export function useCitySettings() {
    const [settings, setSettings] = useState<CitySettings>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                return { ...DEFAULT_CITY_SETTINGS, ...parsed };
            }
        } catch (error) {
            console.warn('Failed to load city settings from localStorage:', error);
        }
        return DEFAULT_CITY_SETTINGS;
    });

    // Persist settings to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (error) {
            console.warn('Failed to save city settings to localStorage:', error);
        }
    }, [settings]);

    const updateColorSettings = useCallback((colorUpdates: Partial<CityColorSettings>) => {
        setSettings(prev => ({
            ...prev,
            colors: { ...prev.colors, ...colorUpdates }
        }));
    }, []);

    const setClusterPalette = useCallback((palette: string[]) => {
        updateColorSettings({ clusterPalette: palette });
    }, [updateColorSettings]);

    const setFolderColors = useCallback((colors: string[]) => {
        updateColorSettings({ folderColors: colors });
    }, [updateColorSettings]);

    const resetToDefaults = useCallback(() => {
        setSettings(DEFAULT_CITY_SETTINGS);
    }, []);

    const applyPresetPalette = useCallback((paletteName: string) => {
        const preset = DEFAULT_CLUSTER_PALETTES.find(p => p.name === paletteName);
        if (preset) {
            setClusterPalette(preset.colors);
        }
    }, [setClusterPalette]);

    return {
        settings,
        updateColorSettings,
        setClusterPalette,
        setFolderColors,
        resetToDefaults,
        applyPresetPalette,
        availablePalettes: DEFAULT_CLUSTER_PALETTES
    };
}

export type UseCitySettingsReturn = ReturnType<typeof useCitySettings>;
