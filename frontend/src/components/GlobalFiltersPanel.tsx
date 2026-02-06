/**
 * Global Filters Panel
 * 
 * Advanced filtering panel for big project support.
 * Provides date ranges, author filters, coupling thresholds, and quick presets.
 */

import { useState } from 'react';
import {
    Filter, Calendar, Users, Link2, Activity, AlertTriangle,
    FileCode, Settings2, Save, Trash2, ChevronDown, ChevronUp,
    X, Bookmark, Zap
} from 'lucide-react';
import { useFilters, useCommonExtensions, type FilterPreset } from '../stores/filterStore';
import { cn } from '@/lib/utils';

interface GlobalFiltersPanelProps {
    isOpen: boolean;
    onClose: () => void;
    availableAuthors?: string[];
}

export function GlobalFiltersPanel({ isOpen, onClose, availableAuthors = [] }: GlobalFiltersPanelProps) {
    const {
        filters,
        setDateRange,
        setCouplingFilter,
        setChurnFilter,
        setAuthorFilter,
        toggleExtension,
        setRiskFilter,
        toggleQuickFilter,
        setPerformanceSettings,
        resetFilters,
        presets,
        savePreset,
        loadPreset,
        deletePreset,
        isFiltering,
        activeFilterCount,
    } = useFilters();

    const extensions = useCommonExtensions();

    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['quick', 'date', 'coupling']));
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const [newPresetDesc, setNewPresetDesc] = useState('');

    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(section)) next.delete(section);
            else next.add(section);
            return next;
        });
    };

    const handleSavePreset = () => {
        if (newPresetName.trim()) {
            savePreset(newPresetName.trim(), newPresetDesc.trim());
            setNewPresetName('');
            setNewPresetDesc('');
            setShowSaveDialog(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="relative ml-auto w-[480px] h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400">
                            <Filter size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-100">Advanced Filters</h2>
                            <p className="text-xs text-slate-500">
                                {isFiltering
                                    ? `${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active`
                                    : 'No filters applied'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isFiltering && (
                            <button
                                onClick={resetFilters}
                                className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                                Clear All
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Presets */}
                    <Section
                        title="Presets"
                        icon={<Bookmark size={16} />}
                        isExpanded={expandedSections.has('presets')}
                        onToggle={() => toggleSection('presets')}
                    >
                        <div className="space-y-2">
                            {presets.map((preset: FilterPreset) => (
                                <div
                                    key={preset.id}
                                    className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors"
                                >
                                    <button
                                        onClick={() => loadPreset(preset.id)}
                                        className="flex-1 text-left"
                                    >
                                        <div className="text-sm font-medium text-slate-200">{preset.name}</div>
                                        <div className="text-xs text-slate-500">{preset.description}</div>
                                    </button>
                                    {preset.id.startsWith('custom-') && (
                                        <button
                                            onClick={() => deletePreset(preset.id)}
                                            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {!showSaveDialog ? (
                                <button
                                    onClick={() => setShowSaveDialog(true)}
                                    className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-700 text-slate-500 hover:text-sky-400 hover:border-sky-500/50 rounded-lg transition-colors"
                                >
                                    <Save size={14} />
                                    Save Current as Preset
                                </button>
                            ) : (
                                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-600 space-y-2">
                                    <input
                                        type="text"
                                        placeholder="Preset name"
                                        value={newPresetName}
                                        onChange={(e) => setNewPresetName(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Description (optional)"
                                        value={newPresetDesc}
                                        onChange={(e) => setNewPresetDesc(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSavePreset}
                                            className="flex-1 px-3 py-1.5 bg-sky-500 text-slate-900 font-medium rounded text-sm hover:bg-sky-400 transition-colors"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => setShowSaveDialog(false)}
                                            className="px-3 py-1.5 text-slate-400 hover:text-slate-200 transition-colors text-sm"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Section>

                    {/* Quick Filters */}
                    <Section
                        title="Quick Filters"
                        icon={<Zap size={16} />}
                        isExpanded={expandedSections.has('quick')}
                        onToggle={() => toggleSection('quick')}
                    >
                        <div className="grid grid-cols-2 gap-2">
                            <QuickFilterButton
                                active={filters.quickFilters.hotFiles}
                                onClick={() => toggleQuickFilter('hotFiles')}
                                icon="🔥"
                                label="Hot Files"
                                description="High commit frequency"
                            />
                            <QuickFilterButton
                                active={filters.quickFilters.recentChanges}
                                onClick={() => toggleQuickFilter('recentChanges')}
                                icon="🕐"
                                label="Recent Changes"
                                description="Last 30 days"
                            />
                            <QuickFilterButton
                                active={filters.quickFilters.highCoupling}
                                onClick={() => toggleQuickFilter('highCoupling')}
                                icon="🔗"
                                label="High Coupling"
                                description=">50% coupling"
                            />
                            <QuickFilterButton
                                active={filters.quickFilters.multipleAuthors}
                                onClick={() => toggleQuickFilter('multipleAuthors')}
                                icon="👥"
                                label="Collaboration"
                                description="Multiple authors"
                            />
                            <QuickFilterButton
                                active={filters.quickFilters.deletedFiles}
                                onClick={() => toggleQuickFilter('deletedFiles')}
                                icon="🗑️"
                                label="Include Deleted"
                                description="Show removed files"
                            />
                        </div>
                    </Section>

                    {/* Date Range */}
                    <Section
                        title="Date Range"
                        icon={<Calendar size={16} />}
                        isExpanded={expandedSections.has('date')}
                        onToggle={() => toggleSection('date')}
                    >
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">From</label>
                                <input
                                    type="date"
                                    value={filters.dateRange.from || ''}
                                    onChange={(e) => setDateRange({ ...filters.dateRange, from: e.target.value || null })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">To</label>
                                <input
                                    type="date"
                                    value={filters.dateRange.to || ''}
                                    onChange={(e) => setDateRange({ ...filters.dateRange, to: e.target.value || null })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                            {[
                                { label: '7d', days: 7 },
                                { label: '30d', days: 30 },
                                { label: '90d', days: 90 },
                                { label: '1y', days: 365 },
                            ].map(({ label, days }) => (
                                <button
                                    key={label}
                                    onClick={() => {
                                        const to = new Date().toISOString().split('T')[0];
                                        const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                                        setDateRange({ from, to });
                                    }}
                                    className="flex-1 px-2 py-1.5 text-xs font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                                >
                                    Last {label}
                                </button>
                            ))}
                        </div>
                    </Section>

                    {/* Coupling Thresholds */}
                    <Section
                        title="Coupling Thresholds"
                        icon={<Link2 size={16} />}
                        isExpanded={expandedSections.has('coupling')}
                        onToggle={() => toggleSection('coupling')}
                    >
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-500 mb-2">Metric</label>
                                <select
                                    value={filters.coupling.metric}
                                    onChange={(e) => setCouplingFilter({ metric: e.target.value as any })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                                >
                                    <option value="jaccard">Jaccard Similarity</option>
                                    <option value="jaccard_weighted">Weighted Jaccard</option>
                                    <option value="p_dst_given_src">P(B|A) - Conditional</option>
                                    <option value="p_src_given_dst">P(A|B) - Reverse</option>
                                </select>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs text-slate-500 mb-2">
                                    <span>Minimum Strength</span>
                                    <span className="text-sky-400">{Math.round(filters.coupling.minStrength * 100)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={filters.coupling.minStrength * 100}
                                    onChange={(e) => setCouplingFilter({ minStrength: parseInt(e.target.value) / 100 })}
                                    className="w-full accent-sky-500"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-xs text-slate-500 mb-2">
                                    <span>Maximum Strength</span>
                                    <span className="text-sky-400">{Math.round(filters.coupling.maxStrength * 100)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={filters.coupling.maxStrength * 100}
                                    onChange={(e) => setCouplingFilter({ maxStrength: parseInt(e.target.value) / 100 })}
                                    className="w-full accent-sky-500"
                                />
                            </div>
                        </div>
                    </Section>

                    {/* Churn Thresholds */}
                    <Section
                        title="Churn Thresholds"
                        icon={<Activity size={16} />}
                        isExpanded={expandedSections.has('churn')}
                        onToggle={() => toggleSection('churn')}
                    >
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-xs text-slate-500 mb-2">
                                    <span>Minimum Commits</span>
                                    <span className="text-amber-400">{filters.churn.minCommits}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={filters.churn.minCommits}
                                    onChange={(e) => setChurnFilter({ minCommits: parseInt(e.target.value) })}
                                    className="w-full accent-amber-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-2">Maximum Commits (optional)</label>
                                <input
                                    type="number"
                                    min={0}
                                    placeholder="No limit"
                                    value={filters.churn.maxCommits || ''}
                                    onChange={(e) => setChurnFilter({ maxCommits: e.target.value ? parseInt(e.target.value) : null })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600"
                                />
                            </div>
                        </div>
                    </Section>

                    {/* Authors */}
                    <Section
                        title="Authors"
                        icon={<Users size={16} />}
                        isExpanded={expandedSections.has('authors')}
                        onToggle={() => toggleSection('authors')}
                    >
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-slate-500 mb-2">Minimum Contributions</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={filters.authors.minContributions}
                                    onChange={(e) => setAuthorFilter({ minContributions: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                                />
                            </div>
                            {availableAuthors.length > 0 && (
                                <div>
                                    <label className="block text-xs text-slate-500 mb-2">Filter by Author</label>
                                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-800/50 rounded-lg">
                                        {availableAuthors.slice(0, 20).map((author) => (
                                            <button
                                                key={author}
                                                onClick={() => {
                                                    const selected = filters.authors.selectedAuthors;
                                                    if (selected.includes(author)) {
                                                        setAuthorFilter({
                                                            selectedAuthors: selected.filter(a => a !== author),
                                                        });
                                                    } else {
                                                        setAuthorFilter({
                                                            selectedAuthors: [...selected, author],
                                                        });
                                                    }
                                                }}
                                                className={cn(
                                                    'px-2 py-1 text-xs rounded-full transition-colors',
                                                    filters.authors.selectedAuthors.includes(author)
                                                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/50'
                                                        : 'bg-slate-700 text-slate-400 hover:text-slate-200'
                                                )}
                                            >
                                                {author.split(' ')[0]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Section>

                    {/* File Types */}
                    <Section
                        title="File Types"
                        icon={<FileCode size={16} />}
                        isExpanded={expandedSections.has('files')}
                        onToggle={() => toggleSection('files')}
                    >
                        <div className="flex flex-wrap gap-2">
                            {extensions.map(({ ext, color }) => (
                                <button
                                    key={ext}
                                    onClick={() => toggleExtension(ext)}
                                    className={cn(
                                        'px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all',
                                        filters.files.extensions.includes(ext)
                                            ? 'ring-2 ring-sky-500'
                                            : 'opacity-60 hover:opacity-100'
                                    )}
                                    style={{
                                        backgroundColor: `${color}20`,
                                        color: color,
                                    }}
                                >
                                    .{ext}
                                </button>
                            ))}
                        </div>
                    </Section>

                    {/* Risk Score */}
                    <Section
                        title="Risk Score"
                        icon={<AlertTriangle size={16} />}
                        isExpanded={expandedSections.has('risk')}
                        onToggle={() => toggleSection('risk')}
                    >
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-xs text-slate-500 mb-2">
                                    <span>Minimum Risk</span>
                                    <span className="text-red-400">{filters.risk.minRiskScore}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={filters.risk.minRiskScore}
                                    onChange={(e) => setRiskFilter({ minRiskScore: parseInt(e.target.value) })}
                                    className="w-full accent-red-500"
                                />
                            </div>
                            <div className="flex gap-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={filters.risk.includeHotspots}
                                        onChange={(e) => setRiskFilter({ includeHotspots: e.target.checked })}
                                        className="rounded border-slate-600 bg-slate-700 text-sky-500"
                                    />
                                    <span className="text-xs text-slate-400">Include Hotspots</span>
                                </label>
                            </div>
                        </div>
                    </Section>

                    {/* Performance Settings */}
                    <Section
                        title="Performance"
                        icon={<Settings2 size={16} />}
                        isExpanded={expandedSections.has('performance')}
                        onToggle={() => toggleSection('performance')}
                    >
                        <div className="space-y-3">
                            <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm text-slate-300">Virtual Scrolling</span>
                                <input
                                    type="checkbox"
                                    checked={filters.performance.virtualScrolling}
                                    onChange={(e) => setPerformanceSettings({ virtualScrolling: e.target.checked })}
                                    className="rounded border-slate-600 bg-slate-700 text-sky-500"
                                />
                            </label>
                            <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm text-slate-300">Graph Sampling</span>
                                <input
                                    type="checkbox"
                                    checked={filters.performance.graphSampling}
                                    onChange={(e) => setPerformanceSettings({ graphSampling: e.target.checked })}
                                    className="rounded border-slate-600 bg-slate-700 text-sky-500"
                                />
                            </label>
                            <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm text-slate-300">Enable Animations</span>
                                <input
                                    type="checkbox"
                                    checked={filters.performance.enableAnimations}
                                    onChange={(e) => setPerformanceSettings({ enableAnimations: e.target.checked })}
                                    className="rounded border-slate-600 bg-slate-700 text-sky-500"
                                />
                            </label>
                            <div>
                                <div className="flex justify-between text-xs text-slate-500 mb-2">
                                    <span>Max Graph Nodes</span>
                                    <span className="text-slate-300">{filters.performance.maxNodesInGraph}</span>
                                </div>
                                <input
                                    type="range"
                                    min={25}
                                    max={500}
                                    step={25}
                                    value={filters.performance.maxNodesInGraph}
                                    onChange={(e) => setPerformanceSettings({ maxNodesInGraph: parseInt(e.target.value) })}
                                    className="w-full accent-slate-500"
                                />
                            </div>
                        </div>
                    </Section>
                </div>
            </div>
        </div>
    );
}

// Section component
function Section({
    title,
    icon,
    isExpanded,
    onToggle,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    isExpanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-slate-800/30 rounded-xl border border-slate-800 overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-3 hover:bg-slate-800/50 transition-colors"
            >
                <div className="flex items-center gap-2 text-slate-300">
                    <span className="text-sky-400">{icon}</span>
                    <span className="font-medium text-sm">{title}</span>
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
            </button>
            {isExpanded && <div className="p-3 pt-0">{children}</div>}
        </div>
    );
}

// Quick filter button component
function QuickFilterButton({
    active,
    onClick,
    icon,
    label,
    description,
}: {
    active: boolean;
    onClick: () => void;
    icon: string;
    label: string;
    description: string;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'p-3 rounded-lg border text-left transition-all',
                active
                    ? 'bg-sky-500/10 border-sky-500/50 text-sky-400'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
            )}
        >
            <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{icon}</span>
                <span className="text-sm font-medium">{label}</span>
            </div>
            <p className="text-xs opacity-70">{description}</p>
        </button>
    );
}

export default GlobalFiltersPanel;
