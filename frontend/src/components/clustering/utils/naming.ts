/**
 * Cluster Naming Utilities
 * 
 * Smart algorithms for generating meaningful cluster names from file paths.
 */

import { EXCLUDED_TOKENS, MIN_TOKEN_LENGTH } from '../constants';

// ============================================================
// Token Extraction
// ============================================================

/** Tokenize a file path intelligently */
function tokenizeFilePath(filePath: string): string[] {
    // Get filename without extension
    const filename = filePath.split('/').pop() || filePath;
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '');

    // Also extract meaningful folder names (last 2-3 folders)
    const parts = filePath.split('/').filter(Boolean);
    const folderParts = parts.slice(-4, -1);

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
            !/^\d+$/.test(t)
        );

    return tokens;
}

/** Capitalize the first letter of a string */
function capitalizeFirst(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================
// Name Generation
// ============================================================

/** 
 * Generate a smart cluster name from file paths.
 * 
 * Algorithm:
 * 1. Tokenize all file paths
 * 2. Count token frequencies (each token counted once per file)
 * 3. Filter tokens appearing in at least 15% of files
 * 4. Select top N most frequent tokens
 * 5. Join with dashes and capitalize
 */
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
    const minOccurrence = Math.max(2, files.length * 0.15);
    const sortedTokens = Array.from(tokenCounts.entries())
        .filter(([_, count]) => count >= minOccurrence)
        .sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1];
            return a[0].length - b[0].length;
        })
        .map(([token]) => token);

    if (sortedTokens.length === 0) {
        // Fallback: use most common folder name
        const folderCounts = new Map<string, number>();
        files.forEach(file => {
            const parts = file.split('/').filter(Boolean);
            if (parts.length > 1) {
                const folder = parts[parts.length - 2];
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

        return 'Cluster';
    }

    // Take top tokens and capitalize first letter of each
    const selectedTokens = sortedTokens.slice(0, maxTokens);
    const name = selectedTokens.map(t => capitalizeFirst(t)).join('-');

    // Add suffix if there are many more files
    const extraFiles = files.length - (tokenCounts.get(selectedTokens[0]) || 0);
    if (extraFiles > files.length * 0.5 && files.length > 5) {
        return `${name}..${files.length}`;
    }

    return name;
}

// ============================================================
// Cluster Ranking
// ============================================================

/**
 * Calculate a smart ranking score for a cluster.
 * 
 * Higher scores indicate more important clusters to show first.
 * Formula: coupling * (1 + log10(fileCount)) * sqrt(fileCount)
 * 
 * This ensures:
 * - High coupling clusters rank higher
 * - Larger clusters rank higher, but with diminishing returns
 * - A 50-file cluster with 80% coupling beats a 5-file cluster with 90% coupling
 */
export function calculateClusterRank(cluster: { avg_coupling?: number; files?: unknown[]; size?: number }): number {
    const coupling = cluster.avg_coupling ?? 0;
    const fileCount = cluster.files?.length || cluster.size || 0;

    if (fileCount === 0) return 0;

    // Log scale for file count to give diminishing returns
    const logFactor = 1 + Math.log10(fileCount);
    // Square root for balanced weighting
    const sizeFactor = Math.sqrt(fileCount);

    return coupling * logFactor * sizeFactor;
}

/**
 * Sort clusters by smart ranking (descending).
 */
export function sortClustersByRank<T extends { avg_coupling?: number; files?: unknown[]; size?: number }>(clusters: T[]): T[] {
    return [...clusters].sort((a, b) => calculateClusterRank(b) - calculateClusterRank(a));
}

/**
 * Add smart names to clusters that don't have names.
 */
export function enrichClustersWithNames<T extends { name?: string; files?: string[] }>(clusters: T[]): (T & { name: string })[] {
    return clusters.map(cluster => ({
        ...cluster,
        name: cluster.name || generateClusterName(cluster.files || [])
    }));
}
