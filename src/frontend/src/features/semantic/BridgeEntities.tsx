import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBridgeEntities, type BridgeEntity } from '@/api/semantic';
import { Card, Badge } from '@/shared';
import { GitBranch } from 'lucide-react';

interface BridgeEntitiesProps {
    repoId: string;
}

export default function BridgeEntities({ repoId }: BridgeEntitiesProps) {
    const [bridges, setBridges] = useState<BridgeEntity[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchBridges = async () => {
            try {
                const data = await getBridgeEntities(repoId, 2);
                setBridges(data);
            } catch (error) {
                console.error('Failed to fetch bridge entities:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchBridges();
    }, [repoId]);

    if (loading) {
        return (
            <div className="p-6">
                <Card className="p-6">
                    <div className="animate-pulse space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-20 bg-slate-800/50 rounded-lg" />
                        ))}
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6">
            <Card className="p-6">
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-slate-200">Bridge Entities</h2>
                    <p className="text-sm text-slate-400 mt-1">
                        Files that span multiple semantic domains ({bridges.length} found)
                    </p>
                </div>

                {bridges.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No bridge entities found.</p>
                        <p className="text-sm mt-2">All files belong to a single domain.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {bridges
                            .sort((a, b) => b.domain_count - a.domain_count)
                            .map((bridge) => (
                                <button
                                    key={bridge.path}
                                    onClick={() => navigate(`/repos/${repoId}/git/files/${encodeURIComponent(bridge.path)}`)}
                                    className="w-full p-4 bg-slate-900/50 rounded-lg border border-slate-800 hover:border-sky-500/50 hover:bg-slate-900 transition-all group text-left"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <GitBranch className="w-5 h-5 text-amber-400 shrink-0" />
                                                <span className="text-sm font-medium text-slate-200 truncate group-hover:text-sky-400 transition-colors">
                                                    {bridge.path.split('/').pop()}
                                                </span>
                                                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                                                    {bridge.domain_count} domains
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-slate-500 truncate mb-3">{bridge.path}</p>
                                            <div className="flex flex-wrap gap-2">
                                                {bridge.domains
                                                    .sort((a, b) => b.score - a.score)
                                                    .map((domain) => (
                                                        <div
                                                            key={domain.domain_id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(`/repos/${repoId}/semantic/domains/${domain.domain_id}`);
                                                            }}
                                                            className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/50 border border-slate-700 hover:border-sky-500/50 transition-colors"
                                                        >
                                                            <span className="text-xs text-slate-300">{domain.domain_name}</span>
                                                            <span className="text-xs text-slate-500">
                                                                {(domain.score * 100).toFixed(0)}%
                                                            </span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="text-right">
                                                <div className="text-xl font-bold text-amber-400">
                                                    {bridge.domain_count}
                                                </div>
                                                <div className="text-xs text-slate-500">domains</div>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
