/**
 * Global Filter Store
 * 
 * Centralized state management for advanced filtering across the application.
 * Supports big project visualization with date ranges, author filters, and more.
 */

import { useState, useCallback, createContext, useContext, useMemo, type ReactNode } from 'react';

export interface DateRange {
    from: string | null;
    to: string | null;
}

export interface CouplingFilter {
    minStrength: number;
    maxStrength: number;
    metric: 'jaccard' | 'jaccard_weighted' | 'p_dst_given_src' | 'p_src_given_dst';
}

export interface ChurnFilter {
    minCommits: number;
    maxCommits: number | null;
    minChurnRate: number;
}

export interface AuthorFilter {
    selectedAuthors: string[];
    excludeAuthors: string[];
    minContributions: number;
}

export interface FileFilter {
    extensions: string[];
    excludeExtensions: string[];
    pathPatterns: string[];
    excludePatterns: string[];
    minFileSize: number | null;
    maxFileSize: number | null;
}

export interface RiskFilter {
    minRiskScore: number;
    maxRiskScore: number;
    includeHotspots: boolean;
    includeLowActivity: boolean;
}

export interface PerformanceSettings {
    virtualScrolling: boolean;
    graphSampling: boolean;
    maxNodesInGraph: number;
    lazyLoadThreshold: number;
    enableAnimations: boolean;
}

export interface GlobalFilters {
    // Date range
    dateRange: DateRange;
    
    // Coupling
    coupling: CouplingFilter;
    
    // Churn
    churn: ChurnFilter;
    
    // Authors
    authors: AuthorFilter;
    
    // Files
    files: FileFilter;
    
    // Risk
    risk: RiskFilter;
    
    // Quick filters
    quickFilters: {
        hotFiles: boolean;
        recentChanges: boolean;
        highCoupling: boolean;
        multipleAuthors: boolean;
        deletedFiles: boolean;
    };
    
    // Performance
    performance: PerformanceSettings;
}

export interface FilterPreset {
    id: string;
    name: string;
    description: string;
    filters: Partial<GlobalFilters>;
    createdAt: string;
}

interface FilterContextValue {
    filters: GlobalFilters;
    setFilters: (filters: Partial<GlobalFilters>) => void;
    resetFilters: () => void;
    
    // Date range helpers
    setDateRange: (range: DateRange) => void;
    
    // Coupling helpers
    setCouplingFilter: (filter: Partial<CouplingFilter>) => void;
    
    // Churn helpers
    setChurnFilter: (filter: Partial<ChurnFilter>) => void;
    
    // Author helpers
    setAuthorFilter: (filter: Partial<AuthorFilter>) => void;
    addAuthorFilter: (author: string) => void;
    removeAuthorFilter: (author: string) => void;
    
    // File helpers
    setFileFilter: (filter: Partial<FileFilter>) => void;
    toggleExtension: (ext: string) => void;
    
    // Risk helpers
    setRiskFilter: (filter: Partial<RiskFilter>) => void;
    
    // Quick filter helpers
    toggleQuickFilter: (key: keyof GlobalFilters['quickFilters']) => void;
    
    // Performance helpers
    setPerformanceSettings: (settings: Partial<PerformanceSettings>) => void;
    
    // Presets
    presets: FilterPreset[];
    savePreset: (name: string, description: string) => void;
    loadPreset: (id: string) => void;
    deletePreset: (id: string) => void;
    
    // Computed
    isFiltering: boolean;
    activeFilterCount: number;
}

const DEFAULT_FILTERS: GlobalFilters = {
    dateRange: { from: null, to: null },
    coupling: {
        minStrength: 0,
        maxStrength: 1,
        metric: 'jaccard',
    },
    churn: {
        minCommits: 0,
        maxCommits: null,
        minChurnRate: 0,
    },
    authors: {
        selectedAuthors: [],
        excludeAuthors: [],
        minContributions: 0,
    },
    files: {
        extensions: [],
        excludeExtensions: [],
        pathPatterns: [],
        excludePatterns: [],
        minFileSize: null,
        maxFileSize: null,
    },
    risk: {
        minRiskScore: 0,
        maxRiskScore: 100,
        includeHotspots: false,
        includeLowActivity: false,
    },
    quickFilters: {
        hotFiles: false,
        recentChanges: false,
        highCoupling: false,
        multipleAuthors: false,
        deletedFiles: false,
    },
    performance: {
        virtualScrolling: true,
        graphSampling: true,
        maxNodesInGraph: 100,
        lazyLoadThreshold: 500,
        enableAnimations: true,
    },
};

const BUILT_IN_PRESETS: FilterPreset[] = [
    {
        id: 'hotspots',
        name: 'Hotspots Analysis',
        description: 'Focus on files with high churn and coupling',
        filters: {
            churn: { minCommits: 20, maxCommits: null, minChurnRate: 0 },
            coupling: { minStrength: 0.3, maxStrength: 1, metric: 'jaccard' },
            quickFilters: { hotFiles: true, highCoupling: true, recentChanges: false, multipleAuthors: false, deletedFiles: false },
        },
        createdAt: new Date().toISOString(),
    },
    {
        id: 'recent-activity',
        name: 'Recent Activity',
        description: 'Focus on files changed in the last 30 days',
        filters: {
            dateRange: {
                from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                to: new Date().toISOString().split('T')[0],
            },
            quickFilters: { recentChanges: true, hotFiles: false, highCoupling: false, multipleAuthors: false, deletedFiles: false },
        },
        createdAt: new Date().toISOString(),
    },
    {
        id: 'high-risk',
        name: 'High Risk Files',
        description: 'Files with high risk scores',
        filters: {
            risk: { minRiskScore: 60, maxRiskScore: 100, includeHotspots: true, includeLowActivity: false },
        },
        createdAt: new Date().toISOString(),
    },
    {
        id: 'collaboration-zones',
        name: 'Collaboration Zones',
        description: 'Files with multiple contributors',
        filters: {
            authors: { selectedAuthors: [], excludeAuthors: [], minContributions: 3 },
            quickFilters: { multipleAuthors: true, hotFiles: false, recentChanges: false, highCoupling: false, deletedFiles: false },
        },
        createdAt: new Date().toISOString(),
    },
];

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
    const [filters, setFiltersState] = useState<GlobalFilters>(DEFAULT_FILTERS);
    const [presets, setPresets] = useState<FilterPreset[]>(() => {
        const saved = localStorage.getItem('filter-presets');
        return saved ? [...BUILT_IN_PRESETS, ...JSON.parse(saved)] : BUILT_IN_PRESETS;
    });

    const setFilters = useCallback((newFilters: Partial<GlobalFilters>) => {
        setFiltersState(prev => ({ ...prev, ...newFilters }));
    }, []);

    const resetFilters = useCallback(() => {
        setFiltersState(DEFAULT_FILTERS);
    }, []);

    const setDateRange = useCallback((range: DateRange) => {
        setFiltersState(prev => ({ ...prev, dateRange: range }));
    }, []);

    const setCouplingFilter = useCallback((filter: Partial<CouplingFilter>) => {
        setFiltersState(prev => ({
            ...prev,
            coupling: { ...prev.coupling, ...filter },
        }));
    }, []);

    const setChurnFilter = useCallback((filter: Partial<ChurnFilter>) => {
        setFiltersState(prev => ({
            ...prev,
            churn: { ...prev.churn, ...filter },
        }));
    }, []);

    const setAuthorFilter = useCallback((filter: Partial<AuthorFilter>) => {
        setFiltersState(prev => ({
            ...prev,
            authors: { ...prev.authors, ...filter },
        }));
    }, []);

    const addAuthorFilter = useCallback((author: string) => {
        setFiltersState(prev => ({
            ...prev,
            authors: {
                ...prev.authors,
                selectedAuthors: [...prev.authors.selectedAuthors, author],
            },
        }));
    }, []);

    const removeAuthorFilter = useCallback((author: string) => {
        setFiltersState(prev => ({
            ...prev,
            authors: {
                ...prev.authors,
                selectedAuthors: prev.authors.selectedAuthors.filter(a => a !== author),
            },
        }));
    }, []);

    const setFileFilter = useCallback((filter: Partial<FileFilter>) => {
        setFiltersState(prev => ({
            ...prev,
            files: { ...prev.files, ...filter },
        }));
    }, []);

    const toggleExtension = useCallback((ext: string) => {
        setFiltersState(prev => {
            const exts = prev.files.extensions;
            return {
                ...prev,
                files: {
                    ...prev.files,
                    extensions: exts.includes(ext)
                        ? exts.filter(e => e !== ext)
                        : [...exts, ext],
                },
            };
        });
    }, []);

    const setRiskFilter = useCallback((filter: Partial<RiskFilter>) => {
        setFiltersState(prev => ({
            ...prev,
            risk: { ...prev.risk, ...filter },
        }));
    }, []);

    const toggleQuickFilter = useCallback((key: keyof GlobalFilters['quickFilters']) => {
        setFiltersState(prev => ({
            ...prev,
            quickFilters: {
                ...prev.quickFilters,
                [key]: !prev.quickFilters[key],
            },
        }));
    }, []);

    const setPerformanceSettings = useCallback((settings: Partial<PerformanceSettings>) => {
        setFiltersState(prev => ({
            ...prev,
            performance: { ...prev.performance, ...settings },
        }));
    }, []);

    const savePreset = useCallback((name: string, description: string) => {
        const preset: FilterPreset = {
            id: `custom-${Date.now()}`,
            name,
            description,
            filters,
            createdAt: new Date().toISOString(),
        };
        const custom = presets.filter(p => p.id.startsWith('custom-'));
        const updated = [...custom, preset];
        setPresets([...BUILT_IN_PRESETS, ...updated]);
        localStorage.setItem('filter-presets', JSON.stringify(updated));
    }, [filters, presets]);

    const loadPreset = useCallback((id: string) => {
        const preset = presets.find(p => p.id === id);
        if (preset) {
            setFiltersState(prev => ({
                ...prev,
                ...preset.filters,
            }));
        }
    }, [presets]);

    const deletePreset = useCallback((id: string) => {
        if (!id.startsWith('custom-')) return;
        const updated = presets.filter(p => p.id !== id);
        setPresets(updated);
        const custom = updated.filter(p => p.id.startsWith('custom-'));
        localStorage.setItem('filter-presets', JSON.stringify(custom));
    }, [presets]);

    const isFiltering = useMemo(() => {
        return (
            filters.dateRange.from !== null ||
            filters.dateRange.to !== null ||
            filters.coupling.minStrength > 0 ||
            filters.coupling.maxStrength < 1 ||
            filters.churn.minCommits > 0 ||
            filters.churn.maxCommits !== null ||
            filters.authors.selectedAuthors.length > 0 ||
            filters.authors.excludeAuthors.length > 0 ||
            filters.files.extensions.length > 0 ||
            filters.files.excludeExtensions.length > 0 ||
            filters.risk.minRiskScore > 0 ||
            filters.risk.maxRiskScore < 100 ||
            Object.values(filters.quickFilters).some(Boolean)
        );
    }, [filters]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.dateRange.from || filters.dateRange.to) count++;
        if (filters.coupling.minStrength > 0 || filters.coupling.maxStrength < 1) count++;
        if (filters.churn.minCommits > 0 || filters.churn.maxCommits !== null) count++;
        if (filters.authors.selectedAuthors.length > 0) count++;
        if (filters.files.extensions.length > 0) count++;
        if (filters.risk.minRiskScore > 0 || filters.risk.maxRiskScore < 100) count++;
        count += Object.values(filters.quickFilters).filter(Boolean).length;
        return count;
    }, [filters]);

    const value: FilterContextValue = {
        filters,
        setFilters,
        resetFilters,
        setDateRange,
        setCouplingFilter,
        setChurnFilter,
        setAuthorFilter,
        addAuthorFilter,
        removeAuthorFilter,
        setFileFilter,
        toggleExtension,
        setRiskFilter,
        toggleQuickFilter,
        setPerformanceSettings,
        presets,
        savePreset,
        loadPreset,
        deletePreset,
        isFiltering,
        activeFilterCount,
    };

    return (
        <FilterContext.Provider value={value}>
            {children}
        </FilterContext.Provider>
    );
}

export function useFilters() {
    const context = useContext(FilterContext);
    if (!context) {
        throw new Error('useFilters must be used within a FilterProvider');
    }
    return context;
}

// Hook for commonly needed extensions
export function useCommonExtensions() {
    return useMemo(() => [
        { ext: 'ts', label: 'TypeScript', color: '#3178c6' },
        { ext: 'tsx', label: 'TSX', color: '#3178c6' },
        { ext: 'js', label: 'JavaScript', color: '#f7df1e' },
        { ext: 'jsx', label: 'JSX', color: '#61dafb' },
        { ext: 'py', label: 'Python', color: '#3776ab' },
        { ext: 'java', label: 'Java', color: '#b07219' },
        { ext: 'go', label: 'Go', color: '#00add8' },
        { ext: 'rs', label: 'Rust', color: '#dea584' },
        { ext: 'css', label: 'CSS', color: '#563d7c' },
        { ext: 'scss', label: 'SCSS', color: '#c6538c' },
        { ext: 'json', label: 'JSON', color: '#292929' },
        { ext: 'yaml', label: 'YAML', color: '#cb171e' },
        { ext: 'md', label: 'Markdown', color: '#083fa1' },
        { ext: 'sql', label: 'SQL', color: '#e38c00' },
    ], []);
}
