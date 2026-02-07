import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRiskFiles, type RiskScore } from '@/api/risk';
import { Card, Badge } from '@/shared';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { getRiskColor, formatRiskScore, getRiskSeverity, getSeverityBadgeColor } from '@/types/risk';

interface RiskFileTableProps {
    repoId: string;
}

type SortField = 'overall_risk' | 'coupling_risk' | 'dependency_risk' | 'churn_risk';
type SortOrder = 'asc' | 'desc';

export default function RiskFileTable({ repoId }: RiskFileTableProps) {
    const [files, setFiles] = useState<RiskScore[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortField, setSortField] = useState<SortField>('overall_risk');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchFiles = async () => {
            setLoading(true);
            try {
                const data = await getRiskFiles(repoId, {
                    sort_by: sortField,
                    order: sortOrder,
                    limit: 100,
                });
                setFiles(data);
            } catch (error) {
                console.error('Failed to fetch risk files:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchFiles();
    }, [repoId, sortField, sortOrder]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="w-4 h-4 text-slate-600" />;
        return sortOrder === 'asc' ? (
            <ArrowUp className="w-4 h-4 text-sky-400" />
        ) : (
            <ArrowDown className="w-4 h-4 text-sky-400" />
        );
    };

    if (loading) {
        return (
            <Card className="p-6">
                <div className="animate-pulse space-y-3">
                    {[...Array(10)].map((_, i) => (
                        <div key={i} className="h-16 bg-slate-800/50 rounded-lg" />
                    ))}
                </div>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-900/50 border-b border-slate-800">
                        <tr>
                            <th className="text-left p-4 text-sm font-medium text-slate-400">File</th>
                            <th className="text-left p-4 text-sm font-medium text-slate-400">
                                <button
                                    onClick={() => handleSort('overall_risk')}
                                    className="flex items-center gap-2 hover:text-slate-200 transition-colors"
                                >
                                    Overall
                                    <SortIcon field="overall_risk" />
                                </button>
                            </th>
                            <th className="text-left p-4 text-sm font-medium text-slate-400">
                                <button
                                    onClick={() => handleSort('coupling_risk')}
                                    className="flex items-center gap-2 hover:text-slate-200 transition-colors"
                                >
                                    Coupling
                                    <SortIcon field="coupling_risk" />
                                </button>
                            </th>
                            <th className="text-left p-4 text-sm font-medium text-slate-400">
                                <button
                                    onClick={() => handleSort('dependency_risk')}
                                    className="flex items-center gap-2 hover:text-slate-200 transition-colors"
                                >
                                    Dependency
                                    <SortIcon field="dependency_risk" />
                                </button>
                            </th>
                            <th className="text-left p-4 text-sm font-medium text-slate-400">
                                <button
                                    onClick={() => handleSort('churn_risk')}
                                    className="flex items-center gap-2 hover:text-slate-200 transition-colors"
                                >
                                    Churn
                                    <SortIcon field="churn_risk" />
                                </button>
                            </th>
                            <th className="text-left p-4 text-sm font-medium text-slate-400">Signals</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {files.map((file) => {
                            const severity = getRiskSeverity(file.overall_risk);

                            return (
                                <tr
                                    key={file.entity_id}
                                    onClick={() => navigate(`/repos/${repoId}/git/files/${encodeURIComponent(file.path)}`)}
                                    className="hover:bg-slate-900/50 cursor-pointer transition-colors"
                                >
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-1 h-8 rounded-full"
                                                style={{ backgroundColor: getRiskColor(file.overall_risk) }}
                                            />
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-slate-200 truncate">
                                                    {file.path.split('/').pop()}
                                                </div>
                                                <div className="text-xs text-slate-500 truncate">{file.path}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="text-lg font-bold"
                                                style={{ color: getRiskColor(file.overall_risk) }}
                                            >
                                                {formatRiskScore(file.overall_risk)}
                                            </span>
                                            <Badge className={getSeverityBadgeColor(severity)}>{severity}</Badge>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 bg-slate-800 rounded-full h-2">
                                                <div
                                                    className="h-2 rounded-full transition-all"
                                                    style={{
                                                        width: `${(file.coupling_risk / 10) * 100}%`,
                                                        backgroundColor: getRiskColor(file.coupling_risk),
                                                    }}
                                                />
                                            </div>
                                            <span className="text-sm text-slate-400 w-8">
                                                {formatRiskScore(file.coupling_risk)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 bg-slate-800 rounded-full h-2">
                                                <div
                                                    className="h-2 rounded-full transition-all"
                                                    style={{
                                                        width: `${(file.dependency_risk / 10) * 100}%`,
                                                        backgroundColor: getRiskColor(file.dependency_risk),
                                                    }}
                                                />
                                            </div>
                                            <span className="text-sm text-slate-400 w-8">
                                                {formatRiskScore(file.dependency_risk)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 bg-slate-800 rounded-full h-2">
                                                <div
                                                    className="h-2 rounded-full transition-all"
                                                    style={{
                                                        width: `${(file.churn_risk / 10) * 100}%`,
                                                        backgroundColor: getRiskColor(file.churn_risk),
                                                    }}
                                                />
                                            </div>
                                            <span className="text-sm text-slate-400 w-8">
                                                {formatRiskScore(file.churn_risk)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-wrap gap-1">
                                            {file.signals.slice(0, 2).map((signal, i) => (
                                                <Badge
                                                    key={i}
                                                    className="text-xs bg-slate-800/50 text-slate-400 border-slate-700"
                                                >
                                                    {signal.description}
                                                </Badge>
                                            ))}
                                            {file.signals.length > 2 && (
                                                <Badge className="text-xs bg-slate-800/50 text-slate-400 border-slate-700">
                                                    +{file.signals.length - 2}
                                                </Badge>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
