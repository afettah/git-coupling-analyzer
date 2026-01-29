/**
 * Export Utilities
 * 
 * Functions for exporting cluster data to various formats.
 */

import type { ClusterData } from '../types';

// ============================================================
// CSV Export
// ============================================================

/** Export a single cluster's files to CSV */
export function exportClusterToCsv(cluster: ClusterData): void {
    const rows = ['path'];
    (cluster.files || []).forEach((file: string) => rows.push(file));

    const csv = rows.join('\n');
    downloadFile(csv, `cluster_${cluster.id}.csv`, 'text/csv');
}

/** Export all clusters to a combined CSV */
export function exportAllClustersToCsv(clusters: ClusterData[]): void {
    const rows = ['cluster_id,cluster_name,path'];

    clusters.forEach(cluster => {
        const name = cluster.name || `Cluster ${cluster.id}`;
        (cluster.files || []).forEach((file: string) => {
            rows.push(`${cluster.id},"${name}","${file}"`);
        });
    });

    const csv = rows.join('\n');
    downloadFile(csv, 'all_clusters.csv', 'text/csv');
}

/** Export cluster summary statistics to CSV */
export function exportClusterSummaryToCsv(clusters: ClusterData[]): void {
    const rows = ['cluster_id,name,file_count,avg_coupling,total_churn'];

    clusters.forEach(cluster => {
        const name = cluster.name || `Cluster ${cluster.id}`;
        const fileCount = cluster.files?.length || cluster.size || 0;
        const coupling = cluster.avg_coupling ?? 0;
        const churn = cluster.total_churn ?? 0;

        rows.push(`${cluster.id},"${name}",${fileCount},${coupling.toFixed(4)},${churn}`);
    });

    const csv = rows.join('\n');
    downloadFile(csv, 'cluster_summary.csv', 'text/csv');
}

// ============================================================
// JSON Export
// ============================================================

/** Export clusters to JSON format */
export function exportClustersToJson(clusters: ClusterData[]): void {
    const data = clusters.map(cluster => ({
        id: cluster.id,
        name: cluster.name,
        file_count: cluster.files?.length || cluster.size || 0,
        avg_coupling: cluster.avg_coupling,
        total_churn: cluster.total_churn,
        files: cluster.files || []
    }));

    const json = JSON.stringify(data, null, 2);
    downloadFile(json, 'clusters.json', 'application/json');
}

// ============================================================
// Helper Functions
// ============================================================

/** Trigger a file download in the browser */
function downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
}

/** Download a blob directly */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
}

/** Copy text to clipboard */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();

        try {
            document.execCommand('copy');
            return true;
        } catch {
            return false;
        } finally {
            document.body.removeChild(textArea);
        }
    }
}
