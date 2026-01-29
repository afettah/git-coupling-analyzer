export const formatPercent = (value?: number) => {
    if (value === undefined || value === null) return '—';
    return `${Math.round(value * 100)}%`;
};

export const formatNumber = (value?: number) => {
    if (value === undefined || value === null) return '—';
    return Intl.NumberFormat().format(value);
};

export const formatDateShort = (iso: string) => {
    const date = new Date(iso);
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }).format(date);
};

export const relativeTime = (iso: string) => {
    const date = new Date(iso);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
        [60, 'second'],
        [60, 'minute'],
        [24, 'hour'],
        [7, 'day'],
        [4.345, 'week'],
        [12, 'month'],
        [Number.POSITIVE_INFINITY, 'year']
    ];
    let value = seconds;
    let unit: Intl.RelativeTimeFormatUnit = 'second';
    for (const [step, stepUnit] of units) {
        if (Math.abs(value) < step) {
            unit = stepUnit;
            break;
        }
        value /= step;
    }
    const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    return formatter.format(-Math.round(value), unit);
};

export const getFileName = (path: string) => path.split('/').pop() || path;

export const getFolderPath = (path: string, depth: number) => {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) return '';
    return parts.slice(0, Math.min(depth, parts.length - 1)).join('/');
};

export const aggregateFolders = (files: string[], depth: number) => {
    const counts = new Map<string, number>();
    files.forEach((file) => {
        const folder = getFolderPath(file, depth);
        if (!folder) return;
        counts.set(folder, (counts.get(folder) || 0) + 1);
    });
    return Array.from(counts.entries())
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count);
};

export interface TreeNode {
    name: string;
    path: string;
    children: TreeNode[];
    files: string[];
}

export const buildFileTree = (files: string[]): TreeNode => {
    const root: TreeNode = { name: 'root', path: '', children: [], files: [] };

    files.forEach((file) => {
        const parts = file.split('/').filter(Boolean);
        let current = root;
        parts.forEach((part, index) => {
            const isFile = index === parts.length - 1;
            if (isFile) {
                current.files.push(file);
                return;
            }
            let child = current.children.find((c) => c.name === part);
            if (!child) {
                child = {
                    name: part,
                    path: current.path ? `${current.path}/${part}` : part,
                    children: [],
                    files: []
                };
                current.children.push(child);
            }
            current = child;
        });
    });

    const sortTree = (node: TreeNode) => {
        node.children.sort((a, b) => a.name.localeCompare(b.name));
        node.children.forEach(sortTree);
    };
    sortTree(root);
    return root;
};

// ============================================================
// Smart Cluster Naming Algorithm
// ============================================================

// Technical tokens to exclude from cluster names
const EXCLUDED_TOKENS = new Set([
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
    // File extensions and technical suffixes
    'ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs', 'rb', 'php', 'cs',
    'vue', 'svelte', 'json', 'yaml', 'yml', 'md', 'css', 'scss', 'less',
    // Single letters and short meaningless tokens
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    // Numbers
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    // Common verbs that don't add meaning
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

// Minimum token length to consider meaningful
const MIN_TOKEN_LENGTH = 2;

// Tokenize a file path/name intelligently
function tokenizeFilePath(filePath: string): string[] {
    // Get filename without extension
    const filename = filePath.split('/').pop() || filePath;
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '');

    // Also extract meaningful folder names (last 2-3 folders)
    const parts = filePath.split('/').filter(Boolean);
    const folderParts = parts.slice(-4, -1); // Get up to 3 parent folders

    // Combine filename and folder parts for tokenization
    const toTokenize = [nameWithoutExt, ...folderParts].join(' ');

    // Split by common delimiters and case boundaries
    const tokens = toTokenize
        // Split camelCase and PascalCase
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        // Split snake_case and kebab-case
        .replace(/[_-]/g, ' ')
        // Split numbers from letters
        .replace(/([a-zA-Z])(\d)/g, '$1 $2')
        .replace(/(\d)([a-zA-Z])/g, '$1 $2')
        // Remove special characters
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        // Split by whitespace
        .split(/\s+/)
        // Normalize to lowercase
        .map(t => t.toLowerCase())
        // Filter out empty, short, and excluded tokens
        .filter(t =>
            t.length >= MIN_TOKEN_LENGTH &&
            !EXCLUDED_TOKENS.has(t) &&
            !/^\d+$/.test(t) // Exclude pure numbers
        );

    return tokens;
}

// Generate a smart cluster name from file paths
export function generateClusterName(files: string[], maxTokens: number = 3): string {
    if (!files || files.length === 0) return 'Empty';

    // Count token frequencies across all files
    const tokenCounts = new Map<string, number>();

    files.forEach(file => {
        const tokens = tokenizeFilePath(file);
        // Use a Set to count each token only once per file
        const uniqueTokens = new Set(tokens);
        uniqueTokens.forEach(token => {
            tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
        });
    });

    // Sort tokens by frequency (descending), then by length (prefer shorter)
    const sortedTokens = Array.from(tokenCounts.entries())
        .filter(([_, count]) => count >= Math.max(2, files.length * 0.15)) // Token must appear in at least 15% of files
        .sort((a, b) => {
            // Primary: frequency (descending)
            if (b[1] !== a[1]) return b[1] - a[1];
            // Secondary: prefer shorter tokens for conciseness
            return a[0].length - b[0].length;
        })
        .map(([token]) => token);

    if (sortedTokens.length === 0) {
        // Fallback: use most common folder name
        const folderCounts = new Map<string, number>();
        files.forEach(file => {
            const parts = file.split('/').filter(Boolean);
            if (parts.length > 1) {
                const folder = parts[parts.length - 2]; // Parent folder
                if (!EXCLUDED_TOKENS.has(folder.toLowerCase())) {
                    folderCounts.set(folder, (folderCounts.get(folder) || 0) + 1);
                }
            }
        });

        const topFolder = Array.from(folderCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([folder]) => folder)[0];

        if (topFolder) {
            return capitalizeFirst(topFolder);
        }

        return `Cluster`;
    }

    // Take top tokens and capitalize first letter of each
    const selectedTokens = sortedTokens.slice(0, maxTokens);
    const name = selectedTokens
        .map(t => capitalizeFirst(t))
        .join('-');

    // Add suffix if there are many more files
    const extraFiles = files.length - (tokenCounts.get(selectedTokens[0]) || 0);
    if (extraFiles > files.length * 0.5 && files.length > 5) {
        return `${name}..${files.length}`;
    }

    return name;
}

function capitalizeFirst(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================
// Smart Cluster Ranking Algorithm
// ============================================================

/**
 * Calculate a smart ranking score for a cluster.
 * Higher scores indicate more important clusters to show first.
 * 
 * The formula combines:
 * - Coupling strength (how tightly files are related)
 * - File count (larger clusters are more significant)
 * - Log scale for file count to prevent huge clusters from dominating
 * 
 * Formula: coupling * (1 + log10(fileCount)) * sqrt(fileCount)
 * This ensures:
 * - High coupling clusters rank higher
 * - Larger clusters rank higher, but with diminishing returns
 * - A 50-file cluster with 80% coupling beats a 5-file cluster with 90% coupling
 */
export function calculateClusterRank(cluster: { avg_coupling?: number; files?: any[]; size?: number }): number {
    const coupling = cluster.avg_coupling ?? 0;
    const fileCount = cluster.files?.length || cluster.size || 0;

    if (fileCount === 0) return 0;

    // Log scale for file count to give diminishing returns to very large clusters
    const logFactor = 1 + Math.log10(fileCount);

    // Square root of file count to balance between coupling and size
    const sizeFactor = Math.sqrt(fileCount);

    // Combined score: coupling weighted by both factors
    return coupling * logFactor * sizeFactor;
}

/**
 * Sort clusters by smart ranking (descending).
 * Always shows the most important (high coupling + significant size) clusters first.
 */
export function sortClustersByRank<T extends { avg_coupling?: number; files?: any[]; size?: number }>(clusters: T[]): T[] {
    return [...clusters].sort((a, b) => calculateClusterRank(b) - calculateClusterRank(a));
}
