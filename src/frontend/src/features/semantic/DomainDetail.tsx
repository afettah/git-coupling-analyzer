import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDomain, type DomainDetail } from '@/api/semantic';
import { Card, Badge } from '@/shared';
import { Brain, Users, TrendingUp, ArrowLeft, GitBranch } from 'lucide-react';

export default function DomainDetailView() {
    const { repoId, domainId } = useParams<{ repoId: string; domainId: string }>();
    const [domain, setDomain] = useState<DomainDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (!repoId || !domainId) return;

        const fetchDomain = async () => {
            try {
                const data = await getDomain(repoId, parseInt(domainId));
                setDomain(data);
            } catch (error) {
                console.error('Failed to fetch domain:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchDomain();
    }, [repoId, domainId]);

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-32 bg-slate-800/50 rounded-lg" />
                    <div className="h-64 bg-slate-800/50 rounded-lg" />
                </div>
            </div>
        );
    }

    if (!domain) {
        return (
            <div className="p-6">
                <Card className="p-12 text-center">
                    <p className="text-slate-400">Domain not found</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(`/repos/${repoId}/semantic/domains`)}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-slate-400" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-200">
                        {domain.label || domain.name}
                    </h1>
                    {domain.description && (
                        <p className="text-slate-400 mt-1">{domain.description}</p>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                            <Users className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-200">{domain.member_count}</div>
                            <div className="text-sm text-slate-400">Files</div>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                            <TrendingUp className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-200">
                                {(domain.coherence_score * 100).toFixed(0)}%
                            </div>
                            <div className="text-sm text-slate-400">Coherence</div>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                            <Brain className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-200">{domain.top_terms.length}</div>
                            <div className="text-sm text-slate-400">Key Terms</div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Top Terms */}
            <Card className="p-6">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Key Terms</h3>
                <div className="flex flex-wrap gap-2">
                    {domain.top_terms.map((term, i) => (
                        <Badge
                            key={i}
                            className="px-3 py-1.5 bg-sky-500/10 text-sky-400 border-sky-500/30"
                        >
                            {term}
                        </Badge>
                    ))}
                </div>
            </Card>

            {/* Cross-Domain Coupling */}
            {domain.cross_coupling && domain.cross_coupling.length > 0 && (
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4">Cross-Domain Coupling</h3>
                    <div className="space-y-2">
                        {domain.cross_coupling.map((coupling) => (
                            <button
                                key={coupling.domain_id}
                                onClick={() => navigate(`/repos/${repoId}/semantic/domains/${coupling.domain_id}`)}
                                className="w-full p-3 bg-slate-900/50 rounded-lg border border-slate-800 hover:border-sky-500/50 hover:bg-slate-900 transition-all flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-3">
                                    <GitBranch className="w-5 h-5 text-slate-400 group-hover:text-sky-400 transition-colors" />
                                    <span className="text-sm text-slate-300 group-hover:text-sky-400 transition-colors">
                                        {coupling.domain_name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-32 bg-slate-800 rounded-full h-2">
                                        <div
                                            className="bg-sky-500 h-2 rounded-full"
                                            style={{ width: `${coupling.coupling_strength * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-slate-400 w-12 text-right">
                                        {(coupling.coupling_strength * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </Card>
            )}

            {/* Files */}
            <Card className="p-6">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">
                    Files in Domain ({domain.files.length})
                </h3>
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                    {domain.files
                        .sort((a, b) => b.score - a.score)
                        .map((file) => (
                            <button
                                key={file.path}
                                onClick={() => navigate(`/repos/${repoId}/git/files/${encodeURIComponent(file.path)}`)}
                                className="w-full p-2 px-3 rounded-lg hover:bg-slate-900/50 transition-colors flex items-center justify-between group text-left"
                            >
                                <span className="text-sm text-slate-300 group-hover:text-sky-400 transition-colors truncate">
                                    {file.path}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="w-16 bg-slate-800 rounded-full h-1.5">
                                        <div
                                            className="bg-sky-500 h-1.5 rounded-full"
                                            style={{ width: `${file.score * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-slate-500 w-10 text-right">
                                        {(file.score * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </button>
                        ))}
                </div>
            </Card>
        </div>
    );
}
