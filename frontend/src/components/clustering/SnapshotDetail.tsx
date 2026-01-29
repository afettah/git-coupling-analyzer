import { useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes, useNavigate, useParams, useLocation } from 'react-router-dom';
import { getClusteringSnapshot, getClusteringSnapshotEdges } from '../../api';
import type { ClusterResult } from '../../api';
import { ClustersTab, ExcalidrawView, ProjectCity } from './views';
import type { ClusterEdge, ClusterData, ClusterFilterState, ViewMode, SortField, SortOrder } from './types';
import { DEFAULT_FILTER_STATE } from './constants';
import { ViewFiltersBar, type ActiveView } from './components';
import { enrichClustersWithNames, filterAndSortClusters } from './utils';

interface SnapshotDetailProps {
    repoId: string;
}

export default function SnapshotDetail({ repoId }: SnapshotDetailProps) {
    const { snapshotId } = useParams<{ snapshotId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [result, setResult] = useState<ClusterResult | null>(null);
    const [name, setName] = useState('');
    const [edges, setEdges] = useState<ClusterEdge[]>([]);
    const [loading, setLoading] = useState(true);

    // Shared filter state across all views
    const [filters, setFilters] = useState<ClusterFilterState>(DEFAULT_FILTER_STATE);

    // View-specific state for Clusters tab
    const [viewMode, setViewMode] = useState<ViewMode>('cards');
    const [sortBy, setSortBy] = useState<SortField>('rank');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [depth, setDepth] = useState(3);
    const [directory, setDirectory] = useState('');

    // City-specific state
    const [colorBy, setColorBy] = useState<'cluster' | 'coupling'>('cluster');

    // Determine active view from URL
    const activeView = useMemo((): ActiveView => {
        if (location.pathname.endsWith('/draw')) return 'excalidraw';
        if (location.pathname.endsWith('/city')) return 'city';
        return 'clusters';
    }, [location.pathname]);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            if (!snapshotId) return;
            setLoading(true);
            try {
                const data = await getClusteringSnapshot(repoId, snapshotId);
                if (!mounted) return;
                setName(data.name);
                setResult(data.result);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => {
            mounted = false;
        };
    }, [repoId, snapshotId]);

    useEffect(() => {
        let mounted = true;
        const loadEdges = async () => {
            if (!snapshotId) return;
            try {
                const data = await getClusteringSnapshotEdges(repoId, snapshotId);
                if (mounted) setEdges(data.edges || []);
            } catch {
                if (mounted) setEdges([]);
            }
        };
        loadEdges();
        return () => {
            mounted = false;
        };
    }, [repoId, snapshotId]);

    const stats = useMemo(() => {
        if (!result) return null;
        return {
            clusters: result.cluster_count || result.clusters.length,
            files: result.clusters.reduce((sum, c) => sum + (c.files?.length || c.size || 0), 0),
            avgCoupling: result.clusters.length
                ? result.clusters.reduce((sum, c) => sum + (c.avg_coupling || 0), 0) / result.clusters.length
                : 0
        };
    }, [result]);

    // Process clusters with shared filters
    const clusters = result?.clusters || [];
    const maxFileCount = useMemo(
        () => Math.max(1, ...clusters.map(c => c.files?.length || c.size || 0)),
        [clusters]
    );

    // Update file range when maxFileCount changes
    useEffect(() => {
        setFilters(prev => ({
            ...prev,
            fileRange: [prev.fileRange[0], Math.max(prev.fileRange[1], maxFileCount)]
        }));
    }, [maxFileCount]);

    // Enrich clusters with names
    const clustersWithNames = useMemo(
        () => enrichClustersWithNames(clusters) as ClusterData[],
        [clusters]
    );

    // Filter clusters (shared across views)
    const filteredClusters = useMemo(
        () => filterAndSortClusters(
            clustersWithNames,
            filters,
            sortBy,
            sortOrder,
            { directory, depth }
        ),
        [clustersWithNames, filters, sortBy, sortOrder, directory, depth]
    );

    // Filter edges to match filtered clusters
    const filteredEdges = useMemo(() => {
        const visibleIds = new Set(filteredClusters.map(c => c.id));
        return edges.filter(e => visibleIds.has(e.from_cluster) && visibleIds.has(e.to_cluster));
    }, [edges, filteredClusters]);

    if (loading || !result) {
        return <div className="text-sm text-slate-500">Loading snapshot…</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <button
                        onClick={() => navigate('..')}
                        className="text-xs text-slate-400 hover:text-slate-200"
                    >
                        ← Back to Snapshots
                    </button>
                    <h2 className="text-2xl font-bold text-slate-100 mt-2">Snapshot: {name}</h2>
                    <p className="text-xs text-slate-500">{result.algorithm} • {stats?.clusters} clusters • {stats?.files} files</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>Average coupling: {Math.round((stats?.avgCoupling || 0) * 100)}%</span>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 border-b border-slate-800">
                <TabLink to={`/repos/${repoId}/clustering/${snapshotId}`} end>Clusters</TabLink>
                <TabLink to={`/repos/${repoId}/clustering/${snapshotId}/draw`}>Excalidraw</TabLink>
                <TabLink to={`/repos/${repoId}/clustering/${snapshotId}/city`}>Project City</TabLink>
            </div>

            {/* Unified Filter Bar */}
            <ViewFiltersBar
                filters={filters}
                onFiltersChange={setFilters}
                maxFileCount={maxFileCount}
                filteredCount={filteredClusters.length}
                totalCount={clusters.length}
                activeView={activeView}
                // Clusters-specific
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
                depth={depth}
                onDepthChange={setDepth}
                directory={directory}
                onDirectoryChange={setDirectory}
                // City-specific
                colorBy={colorBy}
                onColorByChange={setColorBy}
            />

            {/* View Content */}
            <Routes>
                <Route index element={
                    <ClustersTab
                        clusters={filteredClusters}
                        viewMode={viewMode}
                        depth={depth}
                    />
                } />
                <Route path="draw" element={
                    <ExcalidrawView
                        clusters={filteredClusters}
                        edges={filteredEdges}
                    />
                } />
                <Route path="city" element={
                    <ProjectCity
                        result={result}
                        filteredClusters={filteredClusters}
                        colorBy={colorBy}
                    />
                } />
            </Routes>
        </div>
    );
}

function TabLink({ to, children, end = false }: { to: string; children: React.ReactNode; end?: boolean }) {
    return (
        <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
                `px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${isActive ? 'border-sky-400 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`
            }
        >
            {children}
        </NavLink>
    );
}
