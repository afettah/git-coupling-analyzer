import { useState, useEffect } from 'react';
import { searchEntities, getGraphStats, getEntity, type Entity, type EntityDetail, type GraphStats } from '@/api/graph';
import { Card } from '@/shared';
import { cn } from '@/lib/utils';
import { Search, BarChart3, GitBranch, ChevronRight, X } from 'lucide-react';

interface KnowledgeGraphProps {
    repoId: string;
}

export default function KnowledgeGraph({ repoId }: KnowledgeGraphProps) {
    const [stats, setStats] = useState<GraphStats | null>(null);
    const [entities, setEntities] = useState<Entity[]>([]);
    const [selectedEntity, setSelectedEntity] = useState<EntityDetail | null>(null);
    const [query, setQuery] = useState('');
    const [kindFilter, setKindFilter] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await getGraphStats(repoId);
                setStats(data);
            } catch { /* ignore */ }
        };
        const fetchEntities = async () => {
            try {
                const data = await searchEntities(repoId, { limit: 50 });
                setEntities(data);
            } catch { /* ignore */ }
            setLoading(false);
        };
        fetchStats();
        fetchEntities();
    }, [repoId]);

    const handleSearch = async () => {
        setLoading(true);
        try {
            const data = await searchEntities(repoId, {
                q: query || undefined,
                kind: kindFilter || undefined,
                limit: 50,
            });
            setEntities(data);
        } catch { /* ignore */ }
        setLoading(false);
    };

    const handleEntityClick = async (entityId: number) => {
        setDetailLoading(true);
        try {
            const detail = await getEntity(repoId, entityId);
            setSelectedEntity(detail);
        } catch { /* ignore */ }
        setDetailLoading(false);
    };

    const kindColors: Record<string, string> = {
        file: 'bg-blue-500/20 text-blue-400',
        class: 'bg-purple-500/20 text-purple-400',
        function: 'bg-green-500/20 text-green-400',
        package: 'bg-orange-500/20 text-orange-400',
        external_package: 'bg-red-500/20 text-red-400',
    };

    return (
        <div className="flex flex-col h-full">
            {/* Stats bar */}
            {stats && (
                <div className="flex gap-4 px-4 pt-4">
                    <Card className="flex-1 p-3">
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <BarChart3 size={14} />
                            <span>Entities: <span className="text-slate-200 font-medium">{stats.total_entities.toLocaleString()}</span></span>
                        </div>
                    </Card>
                    <Card className="flex-1 p-3">
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <GitBranch size={14} />
                            <span>Relationships: <span className="text-slate-200 font-medium">{stats.total_relationships.toLocaleString()}</span></span>
                        </div>
                    </Card>
                    <Card className="flex-1 p-3">
                        <div className="text-sm text-slate-400">
                            Avg Degree: <span className="text-slate-200 font-medium">{stats.avg_degree}</span>
                            {' · '}
                            Density: <span className="text-slate-200 font-medium">{stats.density}</span>
                        </div>
                    </Card>
                </div>
            )}

            {/* Search */}
            <div className="flex gap-2 px-4 pt-4">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input data-testid="knowledge-graph-input-input-1"
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="Search entities..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                </div>
                <select data-testid="knowledge-graph-select-select-1"
                    value={kindFilter}
                    onChange={e => setKindFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                >
                    <option value="">All kinds</option>
                    {stats?.by_kind && Object.keys(stats.by_kind).map(k => (
                        <option key={k} value={k}>{k} ({stats.by_kind[k]})</option>
                    ))}
                </select>
                <button data-testid="knowledge-graph-btn-btn-1"
                    onClick={handleSearch}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
                >
                    Search
                </button>
            </div>

            {/* Content */}
            <div className="flex flex-1 overflow-hidden p-4 gap-4">
                {/* Entity list */}
                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="text-center text-slate-400 py-8">Loading...</div>
                    ) : entities.length === 0 ? (
                        <div className="text-center text-slate-400 py-8">No entities found</div>
                    ) : (
                        <div className="space-y-1">
                            {entities.map(e => (
                                <button data-testid="knowledge-graph-btn-btn-2"
                                    key={e.entity_id}
                                    onClick={() => handleEntityClick(e.entity_id)}
                                    className={cn(
                                        'w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors',
                                        selectedEntity?.entity_id === e.entity_id
                                            ? 'bg-slate-700'
                                            : 'hover:bg-slate-800/50'
                                    )}
                                >
                                    <span className={cn('text-xs px-2 py-0.5 rounded', kindColors[e.kind] || 'bg-slate-700 text-slate-400')}>
                                        {e.kind}
                                    </span>
                                    <span className="text-sm text-slate-200 truncate flex-1">{e.qualified_name}</span>
                                    <ChevronRight size={14} className="text-slate-500 shrink-0" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Detail panel */}
                {selectedEntity && (
                    <Card className="w-96 shrink-0 overflow-auto p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-slate-200 truncate">{selectedEntity.name}</h3>
                            <button data-testid="knowledge-graph-btn-btn-3" onClick={() => setSelectedEntity(null)} className="text-slate-500 hover:text-slate-300">
                                <X size={16} />
                            </button>
                        </div>
                        {detailLoading ? (
                            <div className="text-slate-400 text-sm">Loading...</div>
                        ) : (
                            <>
                                <div className="text-xs text-slate-500 mb-3 break-all">{selectedEntity.qualified_name}</div>
                                <div className="flex gap-2 mb-4">
                                    <span className={cn('text-xs px-2 py-0.5 rounded', kindColors[selectedEntity.kind] || 'bg-slate-700 text-slate-400')}>
                                        {selectedEntity.kind}
                                    </span>
                                    {selectedEntity.language && (
                                        <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400">
                                            {selectedEntity.language}
                                        </span>
                                    )}
                                </div>

                                {selectedEntity.relationships && (
                                    <>
                                        {selectedEntity.relationships.outgoing.length > 0 && (
                                            <div className="mb-3">
                                                <h4 className="text-xs font-medium text-slate-400 mb-1">
                                                    Outgoing ({selectedEntity.relationships.outgoing.length})
                                                </h4>
                                                <div className="space-y-1 max-h-40 overflow-auto">
                                                    {selectedEntity.relationships.outgoing.slice(0, 20).map(r => (
                                                        <div
                                                            key={r.rel_id}
                                                            className="text-xs text-slate-300 px-2 py-1 bg-slate-800 rounded cursor-pointer hover:bg-slate-700"
                                                            onClick={() => handleEntityClick(r.dst_entity_id)}
                                                        >
                                                            <span className="text-slate-500">{r.rel_kind}</span>
                                                            {' → '}
                                                            <span>{r.dst_entity?.qualified_name || r.dst_entity_id}</span>
                                                            <span className="text-slate-500 ml-1">({r.weight.toFixed(3)})</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {selectedEntity.relationships.incoming.length > 0 && (
                                            <div>
                                                <h4 className="text-xs font-medium text-slate-400 mb-1">
                                                    Incoming ({selectedEntity.relationships.incoming.length})
                                                </h4>
                                                <div className="space-y-1 max-h-40 overflow-auto">
                                                    {selectedEntity.relationships.incoming.slice(0, 20).map(r => (
                                                        <div
                                                            key={r.rel_id}
                                                            className="text-xs text-slate-300 px-2 py-1 bg-slate-800 rounded cursor-pointer hover:bg-slate-700"
                                                            onClick={() => handleEntityClick(r.src_entity_id)}
                                                        >
                                                            <span>{r.src_entity?.qualified_name || r.src_entity_id}</span>
                                                            {' → '}
                                                            <span className="text-slate-500">{r.rel_kind}</span>
                                                            <span className="text-slate-500 ml-1">({r.weight.toFixed(3)})</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </Card>
                )}
            </div>
        </div>
    );
}
