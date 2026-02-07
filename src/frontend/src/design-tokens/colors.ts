/**
 * Color Design Tokens
 * 
 * Centralized color palette for consistent theming.
 */

export const colors = {
    // Base slate palette
    slate: {
        50: '#f8fafc',
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
        700: '#334155',
        800: '#1e293b',
        900: '#0f172a',
        950: '#020617',
    },

    // Semantic colors
    primary: '#38bdf8',
    success: '#22c55e',
    warning: '#facc15',
    error: '#ef4444',
    info: '#60a5fa',

    // Extended semantic
    sky: {
        400: '#38bdf8',
        500: '#0ea5e9',
    },
    emerald: {
        400: '#34d399',
        500: '#10b981',
    },
    amber: {
        400: '#fbbf24',
        500: '#f59e0b',
    },
    rose: {
        400: '#fb7185',
        500: '#f43f5e',
        600: '#e11d48',
    },

    // Coupling strength colors
    coupling: {
        veryHigh: '#ef4444',
        high: '#f97316',
        medium: '#facc15',
        low: '#22c55e',
        veryLow: '#38bdf8',
    },

    // Cluster visualization palette
    clusters: [
        '#38bdf8', '#22c55e', '#f97316', '#e879f9', '#facc15',
        '#60a5fa', '#34d399', '#fb7185', '#a78bfa', '#fbbf24',
        '#2dd4bf', '#f472b6', '#818cf8', '#fb923c', '#4ade80',
        '#c084fc', '#fcd34d', '#67e8f9', '#f87171', '#a3e635',
    ],

    // Special purpose
    unclustered: '#64748b',
    grayed: '#374151',

    // District level colors for treemap
    district: [
        '#1e293b',
        '#334155',
        '#475569',
        '#64748b',
        '#94a3b8',
    ],
} as const;

/** Coupling color thresholds */
export const COUPLING_THRESHOLDS = {
    veryHigh: 0.8,
    high: 0.6,
    medium: 0.4,
    low: 0.2,
} as const;

/** Get color based on coupling strength */
export function getCouplingColor(coupling: number): string {
    if (coupling >= COUPLING_THRESHOLDS.veryHigh) return colors.coupling.veryHigh;
    if (coupling >= COUPLING_THRESHOLDS.high) return colors.coupling.high;
    if (coupling >= COUPLING_THRESHOLDS.medium) return colors.coupling.medium;
    if (coupling >= COUPLING_THRESHOLDS.low) return colors.coupling.low;
    return colors.coupling.veryLow;
}

/** Get cluster color by index (loops through palette) */
export function getClusterColor(index: number): string {
    return colors.clusters[index % colors.clusters.length];
}

export type ColorToken = keyof typeof colors;
