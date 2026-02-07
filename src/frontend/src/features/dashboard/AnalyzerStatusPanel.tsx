import { useEffect, useState } from 'react';
import { Play, CheckCircle, XCircle, Loader, Clock, AlertCircle } from 'lucide-react';
import { listAnalyzers, runAnalyzer, type AnalyzerInfo } from '@/api/analyzers';
import { Button, Card, Badge } from '@/shared';

interface AnalyzerStatusPanelProps {
    repoId: string;
    onAnalysisStarted?: (type: string, taskId: string) => void;
}

export default function AnalyzerStatusPanel({ repoId, onAnalysisStarted }: AnalyzerStatusPanelProps) {
    const [analyzers, setAnalyzers] = useState<AnalyzerInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState<Set<string>>(new Set());

    const fetchAnalyzers = async () => {
        try {
            const data = await listAnalyzers(repoId);
            setAnalyzers(data);
        } catch (error) {
            console.error('Failed to fetch analyzers:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalyzers();
        const interval = setInterval(fetchAnalyzers, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, [repoId]);

    const handleRun = async (type: string) => {
        setRunning(prev => new Set(prev).add(type));
        try {
            const result = await runAnalyzer(repoId, type);
            onAnalysisStarted?.(type, result.task_id);
            await fetchAnalyzers();
        } catch (error) {
            console.error(`Failed to run ${type} analyzer:`, error);
        } finally {
            setRunning(prev => {
                const next = new Set(prev);
                next.delete(type);
                return next;
            });
        }
    };

    const getStatusIcon = (state?: string) => {
        switch (state) {
            case 'completed':
                return <CheckCircle className="w-5 h-5 text-green-400" />;
            case 'running':
                return <Loader className="w-5 h-5 text-blue-400 animate-spin" />;
            case 'pending':
                return <Clock className="w-5 h-5 text-yellow-400" />;
            case 'failed':
                return <XCircle className="w-5 h-5 text-red-400" />;
            default:
                return <AlertCircle className="w-5 h-5 text-slate-500" />;
        }
    };

    const getStatusBadge = (state?: string) => {
        const colors = {
            completed: 'bg-green-500/20 text-green-400 border-green-500/30',
            running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
            failed: 'bg-red-500/20 text-red-400 border-red-500/30',
            not_run: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        };
        return colors[state as keyof typeof colors] || colors.not_run;
    };

    if (loading) {
        return (
            <Card className="p-6">
                <div className="flex items-center justify-center py-8">
                    <Loader className="w-8 h-8 text-sky-500 animate-spin" />
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">Analyzers</h3>
            <div className="space-y-3">
                {analyzers.map((analyzer) => (
                    <div
                        key={analyzer.type}
                        className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
                    >
                        <div className="flex items-center gap-3 flex-1">
                            {getStatusIcon(analyzer.status?.state)}
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-medium text-slate-200">{analyzer.name}</h4>
                                    {analyzer.status && (
                                        <Badge className={getStatusBadge(analyzer.status.state)}>
                                            {analyzer.status.state}
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-slate-400 mt-1">{analyzer.description}</p>
                                {analyzer.last_run && (
                                    <p className="text-xs text-slate-500 mt-1">
                                        Last run: {new Date(analyzer.last_run).toLocaleString()}
                                    </p>
                                )}
                                {analyzer.status?.progress !== undefined && (
                                    <div className="mt-2">
                                        <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                                            <span>{analyzer.status.stage || 'Processing'}</span>
                                            <span>{Math.round(analyzer.status.progress * 100)}%</span>
                                        </div>
                                        <div className="w-full bg-slate-800 rounded-full h-1.5">
                                            <div
                                                className="bg-sky-500 h-1.5 rounded-full transition-all"
                                                style={{ width: `${analyzer.status.progress * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <Button
                            onClick={() => handleRun(analyzer.type)}
                            disabled={!analyzer.available || running.has(analyzer.type) || analyzer.status?.state === 'running'}
                            size="sm"
                            className="ml-4"
                        >
                            {running.has(analyzer.type) || analyzer.status?.state === 'running' ? (
                                <>
                                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                                    Running
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4 mr-2" />
                                    Run
                                </>
                            )}
                        </Button>
                    </div>
                ))}
            </div>
        </Card>
    );
}
