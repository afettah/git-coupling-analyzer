import { useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { getClusteringSnapshot, getClusteringSnapshotEdges } from '../../api';
import type { ClusterResult } from '../../api';
import ClustersTab from './ClustersTab';
import ExcalidrawView from './ExcalidrawView';
import ProjectCity from './ProjectCity';
import type { ClusterEdge } from './types';

interface SnapshotDetailProps {
    repoId: string;
}

export default function SnapshotDetail({ repoId }: SnapshotDetailProps) {
    const { snapshotId } = useParams<{ snapshotId: string }>();
    const navigate = useNavigate();
    const [result, setResult] = useState<ClusterResult | null>(null);
    const [name, setName] = useState('');
    const [edges, setEdges] = useState<ClusterEdge[]>([]);
    const [loading, setLoading] = useState(true);

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

            <div className="flex items-center gap-2 border-b border-slate-800">
                <TabLink to={`/repos/${repoId}/clustering/${snapshotId}`} end>Clusters</TabLink>
                <TabLink to={`/repos/${repoId}/clustering/${snapshotId}/draw`}>Excalidraw</TabLink>
                <TabLink to={`/repos/${repoId}/clustering/${snapshotId}/city`}>Project City</TabLink>
            </div>

            <Routes>
                <Route index element={<ClustersTab snapshot={result} />} />
                <Route path="draw" element={<ExcalidrawView clusters={result.clusters} edges={edges} />} />
                <Route path="city" element={<ProjectCity clusters={result.clusters} />} />
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
