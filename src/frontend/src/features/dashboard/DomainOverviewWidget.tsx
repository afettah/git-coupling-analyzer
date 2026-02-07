import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Users, TrendingUp } from 'lucide-react';
import { getDomains, type Domain } from '@/api/semantic';
import { Card } from '@/shared';

interface DomainOverviewWidgetProps {
    repoId: string;
    limit?: number;
}

export default function DomainOverviewWidget({ repoId, limit = 4 }: DomainOverviewWidgetProps) {
    const [domains, setDomains] = useState<Domain[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDomains = async () => {
            try {
                const data = await getDomains(repoId);
                setDomains(data.slice(0, limit));
            } catch (error) {
                console.error('Failed to fetch domains:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchDomains();
    }, [repoId, limit]);

    const getDomainColor = (index: number): string => {
        const colors = [
            '#3b82f6', // blue
            '#8b5cf6', // purple
            '#10b981', // green
            '#f59e0b', // amber
            '#ec4899', // pink
            '#06b6d4', // cyan
        ];
        return colors[index % colors.length];
    };

    if (loading) {
        return (
            <Card className="p-6">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Semantic Domains</h3>
                <div className="grid grid-cols-2 gap-3">
                    {[...Array(limit)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                            <div className="h-24 bg-slate-800/50 rounded-lg" />
                        </div>
                    ))}
                </div>
            </Card>
        );
    }

    if (domains.length === 0) {
        return (
            <Card className="p-6">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Semantic Domains</h3>
                <p className="text-slate-400 text-sm text-center py-8">
                    No domains discovered yet. Run semantic analysis first.
                </p>
            </Card>
        );
    }

    return (
        <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-200">Semantic Domains</h3>
                <button
                    onClick={() => navigate(`/repos/${repoId}/semantic/domains`)}
                    className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                >
                    View all →
                </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
                {domains.map((domain, index) => (
                    <button
                        key={domain.domain_id}
                        onClick={() => navigate(`/repos/${repoId}/semantic/domains/${domain.domain_id}`)}
                        className="text-left p-4 rounded-lg border transition-all group hover:scale-105"
                        style={{
                            backgroundColor: `${getDomainColor(index)}15`,
                            borderColor: `${getDomainColor(index)}40`,
                        }}
                    >
                        <div className="flex items-start gap-3">
                            <div
                                className="p-2 rounded-lg"
                                style={{ backgroundColor: `${getDomainColor(index)}20` }}
                            >
                                <Brain className="w-5 h-5" style={{ color: getDomainColor(index) }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4
                                    className="text-sm font-semibold mb-1 truncate group-hover:underline"
                                    style={{ color: getDomainColor(index) }}
                                >
                                    {domain.label || domain.name}
                                </h4>
                                <div className="flex items-center gap-3 text-xs text-slate-400">
                                    <div className="flex items-center gap-1">
                                        <Users className="w-3 h-3" />
                                        <span>{domain.member_count} files</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" />
                                        <span>{(domain.coherence_score * 100).toFixed(0)}%</span>
                                    </div>
                                </div>
                                {domain.top_terms.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {domain.top_terms.slice(0, 3).map((term, i) => (
                                            <span
                                                key={i}
                                                className="text-xs px-1.5 py-0.5 rounded"
                                                style={{
                                                    backgroundColor: `${getDomainColor(index)}20`,
                                                    color: getDomainColor(index),
                                                }}
                                            >
                                                {term}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </Card>
    );
}
