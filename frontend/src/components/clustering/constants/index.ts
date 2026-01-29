/**
 * Clustering Module Constants
 * 
 * Centralized constants for colors, thresholds, and configuration values.
 */

// ============================================================
// Color Palettes
// ============================================================

/** Color palette for cluster visualization */
export const CLUSTER_PALETTE = [
    '#38bdf8', '#22c55e', '#f97316', '#e879f9', '#facc15',
    '#60a5fa', '#34d399', '#fb7185', '#a78bfa', '#fbbf24',
    '#2dd4bf', '#f472b6', '#818cf8', '#fb923c', '#4ade80',
    '#c084fc', '#fcd34d', '#67e8f9', '#f87171', '#a3e635'
] as const;

/** Color for unclustered/grayed items */
export const UNCLUSTERED_COLOR = '#64748b';
export const GRAYED_COLOR = '#374151';

/** Coupling strength color thresholds */
export const COUPLING_COLORS = {
    veryHigh: { threshold: 0.8, color: '#ef4444' },  // Red
    high: { threshold: 0.6, color: '#f97316' },       // Orange
    medium: { threshold: 0.4, color: '#facc15' },     // Yellow
    low: { threshold: 0.2, color: '#22c55e' },        // Green
    veryLow: { threshold: 0, color: '#38bdf8' }       // Blue
} as const;

/** Get color based on coupling strength */
export function getCouplingColor(coupling: number): string {
    if (coupling >= COUPLING_COLORS.veryHigh.threshold) return COUPLING_COLORS.veryHigh.color;
    if (coupling >= COUPLING_COLORS.high.threshold) return COUPLING_COLORS.high.color;
    if (coupling >= COUPLING_COLORS.medium.threshold) return COUPLING_COLORS.medium.color;
    if (coupling >= COUPLING_COLORS.low.threshold) return COUPLING_COLORS.low.color;
    return COUPLING_COLORS.veryLow.color;
}

/** District level colors for treemap visualization */
export const DISTRICT_COLORS = [
    '#1e293b', // Level 0 - darkest
    '#334155', // Level 1
    '#475569', // Level 2
    '#64748b', // Level 3
    '#94a3b8'  // Level 4 - lightest
] as const;

// ============================================================
// Default Filter Values
// ============================================================

export const DEFAULT_FILTER_STATE = {
    minClusterSize: 2,
    couplingRange: [0.05, 1] as [number, number],
    fileRange: [0, 100] as [number, number],
    search: ''
} as const;

export const DEFAULT_SORT = {
    field: 'rank' as const,
    order: 'desc' as const
};

export const DEFAULT_VIEW_MODE = 'cards' as const;
export const DEFAULT_FOLDER_DEPTH = 3;

// ============================================================
// Visualization Constants
// ============================================================

/** Excalidraw element dimensions */
export const EXCALIDRAW_CONFIG = {
    boxWidth: 400,
    boxHeight: 300,
    gapX: 120,
    gapY: 100,
    fileBoxWidth: 50,
    fileBoxHeight: 30,
    fileGap: 8,
    filesPerRow: 5,
    maxFilesPerCluster: 20,
    filesStartY: 50,
    filesStartX: 16
} as const;

/** ProjectCity building dimensions */
export const CITY_CONFIG = {
    buildingWidth: 0.6,
    buildingSpacing: 0.15,
    maxDepth: 4,
    heightScaleFactor: 1.5,
    folderGap: 0.8,
    labelMargin: 1.5,
    minDistrictSize: 2,
    baseCitySize: 20,
    // Deprecated - use new names above
    defaultMaxDepth: 4,
    defaultHeightScale: 1.5,
    defaultFolderGap: 0.8,
    defaultLabelMargin: 1.5
} as const;

// ============================================================
// Token Exclusion for Smart Naming
// ============================================================

/** Technical tokens to exclude from cluster names */
export const EXCLUDED_TOKENS = new Set([
    // Common technical terms
    'index', 'main', 'app', 'module', 'component', 'components',
    'service', 'services', 'model', 'models', 'util', 'utils', 'utility',
    'helper', 'helpers', 'common', 'shared', 'base', 'core', 'lib', 'libs',
    'src', 'source', 'test', 'tests', 'spec', 'specs', '__tests__',
    'type', 'types', 'interface', 'interfaces', 'enum', 'enums',
    'config', 'configuration', 'settings', 'options', 'constants',
    'impl', 'implementation', 'abstract', 'default', 'factory',
    'manager', 'handler', 'controller', 'provider', 'consumer',
    'repository', 'store', 'state', 'reducer', 'action', 'actions',
    'middleware', 'interceptor', 'guard', 'filter', 'pipe',
    'dto', 'entity', 'schema', 'migration', 'migrations', 'seed', 'seeds',
    // File extensions
    'ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs', 'rb', 'php', 'cs',
    'vue', 'svelte', 'json', 'yaml', 'yml', 'md', 'css', 'scss', 'less',
    // Single letters and short tokens
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    // Common verbs
    'get', 'set', 'create', 'update', 'delete', 'remove', 'add', 'list',
    'fetch', 'load', 'save', 'read', 'write', 'parse', 'format', 'render',
    'init', 'initialize', 'setup', 'build', 'make', 'run', 'start', 'stop',
    'handle', 'process', 'execute', 'perform', 'do', 'use', 'apply',
    'find', 'search', 'filter', 'sort', 'map', 'reduce', 'transform',
    'validate', 'check', 'verify', 'is', 'has', 'can', 'should', 'will',
    // Common adjectives
    'new', 'old', 'current', 'previous', 'next', 'first', 'last',
    'all', 'any', 'some', 'none', 'many', 'few', 'more', 'less',
    'internal', 'external', 'public', 'private', 'protected', 'static',
    // Generic terms
    'data', 'info', 'item', 'items', 'list', 'array', 'object', 'value',
    'result', 'response', 'request', 'params', 'args', 'options', 'context',
    'error', 'exception', 'message', 'event', 'events', 'callback', 'promise',
    'async', 'sync', 'input', 'output', 'file', 'files', 'path', 'paths',
    'name', 'id', 'key', 'keys', 'prop', 'props', 'attr', 'attrs',
    // Folder structure terms
    'features', 'feature', 'pages', 'page', 'views', 'view', 'screens', 'screen',
    'routes', 'route', 'router', 'routing', 'api', 'apis', 'endpoints', 'endpoint',
    'assets', 'images', 'icons', 'fonts', 'styles', 'themes', 'theme',
    'hooks', 'hook', 'context', 'contexts', 'providers', 'layouts', 'layout',
    'widgets', 'widget', 'elements', 'element', 'blocks', 'block', 'sections', 'section',
    // Misc
    'v1', 'v2', 'v3', 'version', 'dev', 'prod', 'staging', 'local',
    'client', 'server', 'backend', 'frontend', 'web', 'mobile', 'desktop'
]);

/** Minimum token length to consider meaningful */
export const MIN_TOKEN_LENGTH = 2;
