import { useEffect, useState } from 'react';
import { getExternalPackages, type ExternalPackage } from '@/api/deps';
import Card from '@/shared/Card';
import { Package, TrendingUp, Users } from 'lucide-react';

interface ExternalPackagesProps {
    repoId: string;
}

export default function ExternalPackages({ repoId }: ExternalPackagesProps) {
    const [packages, setPackages] = useState<ExternalPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<'name' | 'usage' | 'files'>('usage');

    useEffect(() => {
        const fetchPackages = async () => {
            try {
                const data = await getExternalPackages(repoId);
                setPackages(data);
            } catch (error) {
                console.error('Failed to fetch external packages:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchPackages();
    }, [repoId]);

    const sortedPackages = [...packages].sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'usage':
                return b.usage_count - a.usage_count;
            case 'files':
                return b.importing_files - a.importing_files;
            default:
                return 0;
        }
    });

    const maxUsage = Math.max(...packages.map(p => p.usage_count), 1);

    if (loading) {
        return (
            <Card className="p-6">
                <div className="animate-pulse space-y-4">
                    {[...Array(10)].map((_, i) => (
                        <div key={i} className="h-16 bg-slate-800/50 rounded-lg" />
                    ))}
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-200">
                    External Dependencies ({packages.length})
                </h3>
                <div className="flex gap-2">
                    <button
                        onClick={() => setSortBy('name')}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${sortBy === 'name'
                                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                                : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600'
                            }`}
                    >
                        Name
                    </button>
                    <button
                        onClick={() => setSortBy('usage')}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${sortBy === 'usage'
                                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                                : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600'
                            }`}
                    >
                        Usage
                    </button>
                    <button
                        onClick={() => setSortBy('files')}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${sortBy === 'files'
                                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                                : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600'
                            }`}
                    >
                        Files
                    </button>
                </div>
            </div>

            {packages.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No external packages found.</p>
                    <p className="text-sm mt-2">Run dependency analysis first.</p>
                </div>
            ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                    {sortedPackages.map((pkg) => (
                        <div
                            key={pkg.name}
                            className="p-4 bg-slate-900/50 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <div className="p-2 bg-sky-500/10 rounded-lg border border-sky-500/20">
                                        <Package className="w-5 h-5 text-sky-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-mono text-sm font-medium text-slate-200 truncate">
                                            {pkg.name}
                                        </h4>
                                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                                            <div className="flex items-center gap-1.5">
                                                <TrendingUp className="w-3.5 h-3.5" />
                                                <span>{pkg.usage_count} imports</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Users className="w-3.5 h-3.5" />
                                                <span>{pkg.importing_files} files</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-sky-400">
                                            {pkg.usage_count}
                                        </div>
                                        <div className="text-xs text-slate-500">uses</div>
                                    </div>
                                </div>
                            </div>
                            {/* Usage bar */}
                            <div className="mt-3">
                                <div className="w-full bg-slate-800 rounded-full h-1.5">
                                    <div
                                        className="bg-sky-500 h-1.5 rounded-full transition-all"
                                        style={{ width: `${(pkg.usage_count / maxUsage) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}
