/**
 * Export Panel
 * 
 * Export coupling analysis results in various formats.
 * Supports CSV, JSON, and PDF report generation.
 */

import { useState } from 'react';
import {
    Download, FileText, FileJson, Table2, FileSpreadsheet,
    CheckCircle, Loader2, X
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

export function ExportPanel({ isOpen, onClose, repoName }: ExportPanelProps) {
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
        
        // Simulate export process
        await new Promise(r => setTimeout(r, 1500));

        // Generate mock data based on format
        let content: string;
        let mimeType: string;
        const filename = `${repoName}-coupling-analysis-${new Date().toISOString().split('T')[0]}`;

        switch (format) {
            case 'json':
                content = JSON.stringify({
                    repository: repoName,
                    exportedAt: new Date().toISOString(),
                    scope,
                    data: {
                        files: exportData.includeFiles ? generateMockFiles() : undefined,
                        coupling: exportData.includeCoupling ? generateMockCoupling() : undefined,
                        hotspots: exportData.includeHotspots ? generateMockHotspots() : undefined,
                    },
                }, null, 2);
                mimeType = 'application/json';
                break;

            case 'markdown':
                content = generateMarkdownReport(repoName, exportData);
                mimeType = 'text/markdown';
                break;

            case 'csv':
            default:
                content = generateCSV(exportData);
                mimeType = 'text/csv';
                break;
        }

        // Download file
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename + EXPORT_OPTIONS.find(o => o.id === format)?.extension;
        a.click();
        URL.revokeObjectURL(url);

        setExporting(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
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
                    <button
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
                                <button
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
                                <button
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
                                    <input
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
                    <button
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

// Mock data generators
function generateMockFiles() {
    return Array.from({ length: 10 }, (_, i) => ({
        path: `src/component${i}.ts`,
        commits: 50 + Math.floor(Math.random() * 100),
        authors: 1 + Math.floor(Math.random() * 5),
    }));
}

function generateMockCoupling() {
    return Array.from({ length: 10 }, (_, i) => ({
        source: `src/file${i}.ts`,
        target: `src/file${i + 1}.ts`,
        coupling: 0.3 + Math.random() * 0.6,
    }));
}

function generateMockHotspots() {
    return Array.from({ length: 5 }, (_, i) => ({
        path: `src/hotspot${i}.ts`,
        riskScore: 60 + Math.floor(Math.random() * 40),
        commits: 100 + Math.floor(Math.random() * 150),
    }));
}

function generateCSV(_data: ExportData): string {
    const lines = ['Path,Commits,Coupling,Risk Score,Authors'];
    for (let i = 0; i < 20; i++) {
        lines.push(`src/file${i}.ts,${50 + Math.floor(Math.random() * 100)},${(0.3 + Math.random() * 0.6).toFixed(2)},${40 + Math.floor(Math.random() * 50)},${1 + Math.floor(Math.random() * 5)}`);
    }
    return lines.join('\n');
}

function generateMarkdownReport(repoName: string, _data: ExportData): string {
    return `# Coupling Analysis Report

## Repository: ${repoName}

**Generated:** ${new Date().toLocaleString()}

---

## Summary

- **Total Files:** 847
- **Total Commits:** 3,421
- **Average Coupling:** 34%
- **Hotspots Identified:** 12

## Top Hotspots

| File | Risk Score | Commits | Coupling |
|------|------------|---------|----------|
| src/core/engine.ts | 89 | 234 | 78% |
| src/api/handlers.ts | 76 | 189 | 65% |
| src/utils/helpers.ts | 72 | 156 | 82% |

## Recommendations

1. **High Priority:** Refactor \`src/core/engine.ts\` - high coupling with multiple modules
2. **Medium Priority:** Consider splitting \`src/utils/helpers.ts\` - too many responsibilities
3. **Low Priority:** Add tests for recently changed files

---

*Generated by LFCA Analyzer*
`;
}

export default ExportPanel;
