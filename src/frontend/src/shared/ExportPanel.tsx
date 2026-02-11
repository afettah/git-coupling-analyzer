/**
 * Export Panel
 * 
 * Export coupling analysis results in various formats.
 * Supports CSV, JSON, and Markdown report generation.
 */

import { useState } from 'react';
import {
    Download, FileText, FileJson, Table2, FileSpreadsheet,
    CheckCircle, Loader2, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    listFiles, getHotspots, getCouplingEdges, getRepoAuthors,
    getRepoTimeline, getDashboardSummary, getClusteringSnapshots,
    getClusteringSnapshot
} from '../api/git';

interface ExportPanelProps {
    isOpen: boolean;
    onClose: () => void;
    repoId: string;
    repoName: string;
}

type ExportFormat = 'csv' | 'json' | 'markdown' | 'excel';
type ExportScope = 'all' | 'filtered' | 'selected';

interface ExportOption {
    id: ExportFormat;
    label: string;
    description: string;
    icon: React.ReactNode;
    extension: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
    {
        id: 'csv',
        label: 'CSV',
        description: 'Comma-separated values, compatible with Excel',
        icon: <Table2 size={20} />,
        extension: '.csv',
    },
    {
        id: 'json',
        label: 'JSON',
        description: 'Structured data for programmatic use',
        icon: <FileJson size={20} />,
        extension: '.json',
    },
    {
        id: 'markdown',
        label: 'Markdown',
        description: 'Formatted report for documentation',
        icon: <FileText size={20} />,
        extension: '.md',
    },
    {
        id: 'excel',
        label: 'Excel',
        description: 'Native Excel workbook with multiple sheets',
        icon: <FileSpreadsheet size={20} />,
        extension: '.xlsx',
    },
];

interface ExportData {
    includeFiles: boolean;
    includeCoupling: boolean;
    includeClusters: boolean;
    includeAuthors: boolean;
    includeTimeline: boolean;
    includeHotspots: boolean;
}

export function ExportPanel({ isOpen, onClose, repoId, repoName }: ExportPanelProps) {
    const [format, setFormat] = useState<ExportFormat>('csv');
    const [scope, setScope] = useState<ExportScope>('all');
    const [exporting, setExporting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [exportData, setExportData] = useState<ExportData>({
        includeFiles: true,
        includeCoupling: true,
        includeClusters: true,
        includeAuthors: true,
        includeTimeline: false,
        includeHotspots: true,
    });

    const handleExport = async () => {
        setExporting(true);

        try {
            const fetchPromises: Record<string, Promise<any>> = {};

            if (exportData.includeFiles) {
                fetchPromises.files = listFiles(repoId, { limit: 500, sort_by: 'commits', sort_dir: 'desc' });
            }
            if (exportData.includeCoupling) {
                fetchPromises.coupling = getCouplingEdges(repoId, { limit: 500, min_weight: 0.1 });
            }
            if (exportData.includeHotspots) {
                fetchPromises.hotspots = getHotspots(repoId, { limit: 100, sort_by: 'risk_score', sort_dir: 'desc' });
            }
            if (exportData.includeAuthors) {
                fetchPromises.authors = getRepoAuthors(repoId, { limit: 50 });
            }
            if (exportData.includeTimeline) {
                fetchPromises.timeline = getRepoTimeline(repoId, { points: 24, granularity: 'monthly' });
            }

            fetchPromises.summary = getDashboardSummary(repoId);

            if (exportData.includeClusters) {
                fetchPromises.snapshots = getClusteringSnapshots(repoId).catch(() => []);
            }

            const keys = Object.keys(fetchPromises);
            const values = await Promise.all(Object.values(fetchPromises));
            const results: Record<string, any> = {};
            keys.forEach((key, i) => results[key] = values[i]);

            if (results.snapshots && results.snapshots.length > 0) {
                try {
                    const latest = results.snapshots[0];
                    const snapshot = await getClusteringSnapshot(repoId, latest.id);
                    results.clusters = snapshot.result;
                } catch {
                    results.clusters = null;
                }
            }

            let content: string;
            let mimeType: string;
            const filename = `${repoName}-coupling-analysis-${new Date().toISOString().split('T')[0]}`;

            switch (format) {
                case 'json':
                    content = JSON.stringify({
                        repository: repoName,
                        exportedAt: new Date().toISOString(),
                        scope,
                        summary: results.summary || null,
                        data: {
                            files: results.files || undefined,
                            coupling: results.coupling || undefined,
                            hotspots: results.hotspots || undefined,
                            authors: results.authors || undefined,
                            timeline: results.timeline || undefined,
                            clusters: results.clusters || undefined,
                        },
                    }, null, 2);
                    mimeType = 'application/json';
                    break;

                case 'markdown':
                    content = generateMarkdownReport(repoName, results);
                    mimeType = 'text/markdown';
                    break;

                case 'csv':
                default:
                    content = generateCSV(results);
                    mimeType = 'text/csv';
                    break;
            }

            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename + EXPORT_OPTIONS.find(o => o.id === format)?.extension;
            a.click();
            URL.revokeObjectURL(url);

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setExporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400">
                            <Download size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-100">Export Analysis</h2>
                            <p className="text-xs text-slate-500">Download coupling data and reports</p>
                        </div>
                    </div>
                    <button data-testid="export-btn-btn-1"
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-6">
                    {/* Format Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-3">Export Format</label>
                        <div className="grid grid-cols-2 gap-2">
                            {EXPORT_OPTIONS.map((option) => (
                                <button data-testid="export-btn-btn-2"
                                    key={option.id}
                                    onClick={() => setFormat(option.id)}
                                    className={cn(
                                        'flex items-center gap-3 p-3 rounded-lg border text-left transition-all',
                                        format === option.id
                                            ? 'bg-sky-500/10 border-sky-500/50 text-sky-400'
                                            : 'border-slate-700 text-slate-400 hover:border-slate-600'
                                    )}
                                >
                                    <span className={format === option.id ? 'text-sky-400' : 'text-slate-500'}>
                                        {option.icon}
                                    </span>
                                    <div>
                                        <div className="font-medium text-sm">{option.label}</div>
                                        <div className="text-[10px] opacity-70">{option.extension}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Scope Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-3">Export Scope</label>
                        <div className="flex gap-2">
                            {[
                                { id: 'all', label: 'All Data' },
                                { id: 'filtered', label: 'Filtered Only' },
                                { id: 'selected', label: 'Selected Items' },
                            ].map((s) => (
                                <button data-testid="export-btn-btn-3"
                                    key={s.id}
                                    onClick={() => setScope(s.id as ExportScope)}
                                    className={cn(
                                        'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                                        scope === s.id
                                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/50'
                                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                                    )}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Data Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-3">Include Data</label>
                        <div className="space-y-2">
                            {[
                                { key: 'includeFiles', label: 'File List', desc: 'All files with commit counts' },
                                { key: 'includeCoupling', label: 'Coupling Data', desc: 'File coupling relationships' },
                                { key: 'includeClusters', label: 'Cluster Analysis', desc: 'Detected modules' },
                                { key: 'includeHotspots', label: 'Hotspots', desc: 'High-risk files' },
                                { key: 'includeAuthors', label: 'Authors', desc: 'Contributor statistics' },
                                { key: 'includeTimeline', label: 'Timeline', desc: 'Historical data' },
                            ].map((item) => (
                                <label
                                    key={item.key}
                                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/50 cursor-pointer"
                                >
                                    <div>
                                        <div className="text-sm text-slate-300">{item.label}</div>
                                        <div className="text-xs text-slate-500">{item.desc}</div>
                                    </div>
                                    <input data-testid="export-input-input-1"
                                        type="checkbox"
                                        checked={exportData[item.key as keyof ExportData]}
                                        onChange={(e) => setExportData(prev => ({
                                            ...prev,
                                            [item.key]: e.target.checked,
                                        }))}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-sky-500"
                                    />
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-5 border-t border-slate-800 bg-slate-900/50">
                    <div className="text-xs text-slate-500">
                        {EXPORT_OPTIONS.find(o => o.id === format)?.description}
                    </div>
                    <button data-testid="export-btn-btn-4"
                        onClick={handleExport}
                        disabled={exporting}
                        className={cn(
                            'flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-colors',
                            success
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-sky-500 hover:bg-sky-400 text-slate-900'
                        )}
                    >
                        {exporting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Exporting...
                            </>
                        ) : success ? (
                            <>
                                <CheckCircle size={16} />
                                Downloaded!
                            </>
                        ) : (
                            <>
                                <Download size={16} />
                                Export
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

function generateCSV(data: Record<string, any>): string {
    const lines: string[] = [];

    if (data.files && data.files.length > 0) {
        lines.push('=== Files ===');
        lines.push('Path,Commits,Exists at HEAD');
        data.files.forEach((f: any) => {
            lines.push(`${f.path},${f.total_commits},${f.exists_at_head}`);
        });
        lines.push('');
    }

    if (data.hotspots && data.hotspots.length > 0) {
        lines.push('=== Hotspots ===');
        lines.push('Path,Risk Score,Commits,Coupling,Authors,Lines Changed');
        data.hotspots.forEach((h: any) => {
            lines.push(`${h.path},${h.riskScore},${h.commits},${(h.coupling * 100).toFixed(0)}%,${h.authors},${h.linesChanged}`);
        });
        lines.push('');
    }

    if (data.coupling && data.coupling.length > 0) {
        lines.push('=== Coupling Edges ===');
        lines.push('Source,Target,Coupling,Pair Count');
        data.coupling.forEach((e: any) => {
            lines.push(`${e.source},${e.target},${e.coupling.toFixed(3)},${e.pair_count}`);
        });
        lines.push('');
    }

    if (data.authors && data.authors.length > 0) {
        lines.push('=== Authors ===');
        lines.push('Name,Commits,Files,Percentage');
        data.authors.forEach((a: any) => {
            lines.push(`${a.name},${a.commits},${a.files},${a.percentage}%`);
        });
    }

    return lines.join('\n');
}

function generateMarkdownReport(repoName: string, data: Record<string, any>): string {
    const summary = data.summary || {};

    let report = `# Coupling Analysis Report\n\n`;
    report += `## Repository: ${repoName}\n\n`;
    report += `**Generated:** ${new Date().toLocaleString()}\n\n---\n\n`;

    report += `## Summary\n\n`;
    report += `- **Total Files:** ${summary.totalFiles?.toLocaleString() || 'N/A'}\n`;
    report += `- **Total Commits:** ${summary.totalCommits?.toLocaleString() || 'N/A'}\n`;
    report += `- **Total Authors:** ${summary.totalAuthors || 'N/A'}\n`;
    report += `- **Average Coupling:** ${summary.avgCoupling ? (summary.avgCoupling * 100).toFixed(0) + '%' : 'N/A'}\n`;
    report += `- **Hotspots Identified:** ${summary.hotspotCount || 'N/A'}\n`;
    report += `- **Health Score:** ${summary.riskScore != null ? (100 - summary.riskScore) : 'N/A'}/100\n\n`;

    if (data.hotspots && data.hotspots.length > 0) {
        report += `## Top Hotspots\n\n`;
        report += `| File | Risk Score | Commits | Coupling |\n`;
        report += `|------|------------|---------|----------|\n`;
        data.hotspots.slice(0, 10).forEach((h: any) => {
            report += `| ${h.path} | ${h.riskScore} | ${h.commits} | ${(h.coupling * 100).toFixed(0)}% |\n`;
        });
        report += '\n';
    }

    if (data.authors && data.authors.length > 0) {
        report += `## Top Contributors\n\n`;
        report += `| Author | Commits | Files | Share |\n`;
        report += `|--------|---------|-------|-------|\n`;
        data.authors.slice(0, 10).forEach((a: any) => {
            report += `| ${a.name} | ${a.commits} | ${a.files} | ${a.percentage}% |\n`;
        });
        report += '\n';
    }

    report += `---\n\n*Generated by LFCA Analyzer*\n`;
    return report;
}

export default ExportPanel;
