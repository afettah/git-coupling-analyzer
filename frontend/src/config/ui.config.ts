/**
 * UI Configuration
 * 
 * Centralized configuration values for UI components.
 */

export const uiConfig = {
    /** Default pagination size */
    defaultPageSize: 20,

    /** Max items before virtualization kicks in */
    virtualizationThreshold: 100,

    /** Debounce delay for search inputs (ms) */
    searchDebounceMs: 300,

    /** Default animation duration (ms) */
    animationDuration: 200,

    /** Graph visualization defaults */
    graph: {
        maxNodes: 100,
        defaultTopK: 25,
        minEdgeWeight: 0.1,
    },

    /** Clustering defaults */
    clustering: {
        defaultAlgorithm: 'louvain',
        defaultMetric: 'jaccard',
    },

    /** Default filter values */
    filters: {
        couplingRange: [0.05, 1] as [number, number],
        fileRange: [0, 100] as [number, number],
        churnRange: [0, 10000] as [number, number],
        authorRange: [0, 50] as [number, number],
    },
} as const;
