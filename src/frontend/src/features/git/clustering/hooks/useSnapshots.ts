/**
 * Snapshots Hook
 * 
 * Manages snapshot CRUD operations with optimistic updates.
 */

import { useCallback, useEffect, useState } from 'react';
import {
    getClusteringSnapshots,
    updateClusteringSnapshot,
    deleteClusteringSnapshot,
    saveClusteringSnapshot
} from '@/api/git';
import type { SnapshotSummary } from '../types';
import type { ClusterResult } from '@/api/git';

export interface UseSnapshotsReturn {
    snapshots: SnapshotSummary[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    rename: (snapshotId: string, name: string, tags?: string[]) => Promise<void>;
    remove: (snapshotId: string) => Promise<void>;
    save: (name: string, result: ClusterResult, tags?: string[]) => Promise<void>;
}

export function useSnapshots(repoId: string): UseSnapshotsReturn {
    const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getClusteringSnapshots(repoId);
            setSnapshots(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load snapshots');
        } finally {
            setLoading(false);
        }
    }, [repoId]);

    const rename = useCallback(async (snapshotId: string, name: string, tags?: string[]) => {
        // Optimistic update
        setSnapshots(prev => prev.map(s =>
            s.id === snapshotId ? { ...s, name, tags } : s
        ));

        try {
            await updateClusteringSnapshot(repoId, snapshotId, { name, tags });
        } catch (err) {
            // Revert on error
            await refresh();
            throw err;
        }
    }, [repoId, refresh]);

    const remove = useCallback(async (snapshotId: string) => {
        // Optimistic update
        setSnapshots(prev => prev.filter(s => s.id !== snapshotId));

        try {
            await deleteClusteringSnapshot(repoId, snapshotId);
        } catch (err) {
            // Revert on error
            await refresh();
            throw err;
        }
    }, [repoId, refresh]);

    const save = useCallback(async (name: string, result: ClusterResult, tags?: string[]) => {
        await saveClusteringSnapshot(repoId, name, result, tags);
        await refresh();
    }, [repoId, refresh]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { snapshots, loading, error, refresh, rename, remove, save };
}

export default useSnapshots;
