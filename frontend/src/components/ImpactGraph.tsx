import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as d3 from 'd3';
import { getImpactGraph, getImpact, getLineage, listFiles, type ApiErrorInfo } from '../api';
import { Search, Info, History } from 'lucide-react';

interface ImpactGraphProps {
    repoId: string;
}

export default function ImpactGraph({ repoId }: ImpactGraphProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const urlPath = searchParams.get('path') || '';

    const svgRef = useRef<SVGSVGElement>(null);
    const [filePath, setFilePath] = useState(urlPath);
    const [topEdges] = useState(25);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [impacts, setImpacts] = useState<any[]>([]);
    const [lineage, setLineage] = useState<any[]>([]);
    const [suggestedPaths, setSuggestedPaths] = useState<string[]>([]);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [autoLoaded, setAutoLoaded] = useState(false);

    const renderChart = useCallback((graph: any) => {
        if (!svgRef.current) return;
        if (!graph || !graph.nodes || !graph.edges) return;
        const width = svgRef.current.clientWidth;
        const height = svgRef.current.clientHeight;
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const g = svg.append('g');

        const simulation = d3.forceSimulation(graph.nodes)
            .force('link', d3.forceLink(graph.edges).id((d: any) => d.id).distance(150))
            .force('charge', d3.forceManyBody().strength(-400))
            .force('center', d3.forceCenter(width / 2, height / 2));

        const link = g.append('g')
            .attr('stroke', '#334155')
            .attr('stroke-opacity', 0.6)
            .selectAll('line')
            .data(graph.edges)
            .join('line')
            .attr('stroke-width', (d: any) => Math.max(1, d.weight * 6));

        const node = g.append('g')
            .selectAll('circle')
            .data(graph.nodes)
            .join('circle')
            .attr('r', (d: any) => d.id === graph.focus_id ? 10 : 6)
            .attr('fill', (d: any) => d.id === graph.focus_id ? '#38bdf8' : '#818cf8')
            .attr('stroke', '#0f172a')
            .attr('stroke-width', 2)
            .call(drag(simulation) as any);

        const labels = g.append('g')
            .selectAll('text')
            .data(graph.nodes)
            .join('text')
            .attr('class', 'text-[10px] fill-slate-400 pointer-events-none')
            .attr('dx', 12)
            .attr('dy', 4)
            .text((d: any) => d.path.split('/').pop());

        node.append('title').text((d: any) => d.path);

        simulation.on('tick', () => {
            link
                .attr('x1', (d: any) => d.source.x)
                .attr('y1', (d: any) => d.source.y)
                .attr('x2', (d: any) => d.target.x)
                .attr('y2', (d: any) => d.target.y);

            node
                .attr('cx', (d: any) => d.x)
                .attr('cy', (d: any) => d.y);

            labels
                .attr('x', (d: any) => d.x)
                .attr('y', (d: any) => d.y);
        });

        svg.call(d3.zoom()
            .scaleExtent([0.1, 8])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            }) as any);
    }, []);

    const loadData = useCallback(async (path: string) => {
        const trimmedPath = path.trim();
        if (!trimmedPath) {
            setErrorMessage('Enter a file path or pick a preset.');
            return;
        }
        setLoading(true);
        setErrorMessage('');
        try {
            const g = await getImpactGraph(repoId, { path: trimmedPath, top: topEdges });
            const imp = await getImpact(repoId, { path: trimmedPath, top: 10 });
            const lin = await getLineage(repoId, trimmedPath);

            setData(g);
            setImpacts(imp);
            setLineage(lin);
            renderChart(g);
        } catch (e) {
            const apiError = e as ApiErrorInfo;
            if (apiError?.status === 404) {
                setErrorMessage('File not found. Pick a file from the tree or a preset.');
            } else if (apiError?.code) {
                setErrorMessage(apiError.message || 'Failed to load impact data.');
            } else {
                setErrorMessage('Failed to load impact data.');
            }
            setData(null);
            setImpacts([]);
            setLineage([]);
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [renderChart, repoId, topEdges]);

    useEffect(() => {
        const loadPresets = async () => {
            try {
                const files = await listFiles(repoId, {
                    current_only: true,
                    limit: 6,
                    sort_by: 'commits',
                    sort_dir: 'desc',
                });
                const paths = files.map((f) => f.path).filter(Boolean);
                setSuggestedPaths(paths);

                // If no path in URL, try to auto-load the first preset
                if (!urlPath && paths.length && !autoLoaded) {
                    setFilePath(paths[0]);
                    setSearchParams({ path: paths[0] }, { replace: true });
                    setAutoLoaded(true);
                }
            } catch (e) {
                console.error(e);
            }
        };

        loadPresets();
    }, [autoLoaded, urlPath, repoId, setSearchParams]);

    useEffect(() => {
        if (urlPath) {
            setFilePath(urlPath);
            loadData(urlPath);
        }
    }, [urlPath, loadData]);

    const drag = (simulation: any) => {
        function dragstarted(event: any) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        function dragged(event: any) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
        function dragended(event: any) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
        return d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended);
    };

    return (
        <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 flex flex-col min-w-0">
                <div className="p-4 border-b border-slate-800 flex gap-4 bg-slate-900/50">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search file path..."
                            value={filePath}
                            onChange={(e) => setFilePath(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && setSearchParams({ path: filePath })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-sky-500 outline-none"
                        />
                        {errorMessage && (
                            <div className="mt-2 text-xs text-rose-400">{errorMessage}</div>
                        )}
                        {!errorMessage && suggestedPaths.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                <span className="text-slate-500">Presets:</span>
                                {suggestedPaths.map((path) => (
                                    <button
                                        key={path}
                                        onClick={() => {
                                            setSearchParams({ path });
                                        }}
                                        className="px-2 py-0.5 rounded border border-slate-800 text-slate-300 hover:text-sky-300 hover:border-sky-400"
                                        title={path}
                                    >
                                        {path.split('/').pop()}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setSearchParams({ path: filePath })}
                        disabled={loading}
                        className="bg-sky-500 hover:bg-sky-400 text-slate-900 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap"
                    >
                        {loading ? 'Loading...' : 'Load Impact'}
                    </button>
                </div>
                <div className="flex-1 relative bg-slate-950">
                    <svg ref={svgRef} className="w-full h-full" />
                    {!data && !loading && (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                            Enter a file path to visualize its coupling graph
                        </div>
                    )}
                    {data && !loading && data.edges?.length === 0 && (
                        <div className="absolute inset-x-0 bottom-4 text-center text-xs text-slate-500">
                            No coupled files found. Try another file, or lower coupling thresholds by rerunning analysis.
                        </div>
                    )}
                </div>
            </div>

            {/* Info Sidebar */}
            <div className="w-80 border-l border-slate-800 bg-slate-900 overflow-y-auto">
                <div className="p-4 space-y-6">
                    <section>
                        <div className="flex items-center gap-2 text-sky-400 font-bold mb-3">
                            <Info size={18} />
                            <h3 className="text-sm">What is an Impact Graph?</h3>
                        </div>
                        <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs text-slate-400 leading-relaxed">
                            This graph visualizes <strong>Logical Coupling</strong>. It shows the most impacted files — the top co-changed neighbors of your selected file,
                            ranked by Jaccard similarity across commits. A high percentage means the files often change together, suggesting a hidden dependency or shared responsibility.
                        </div>
                    </section>

                    <section>
                        <div className="flex items-center gap-2 text-sky-400 font-bold mb-3">
                            <Info size={18} />
                            <h3 className="text-sm">Top Impacts</h3>
                        </div>
                        <div className="space-y-2">
                            {impacts.length ? impacts.map((imp, i) => (
                                <div key={i} className="bg-slate-950 p-2 rounded border border-slate-800 flex justify-between items-center text-xs">
                                    <div className="truncate pr-2 font-mono" title={imp.path}>{imp.path?.split('/').pop()}</div>
                                    <div className="text-sky-400 font-bold">{(imp.jaccard * 100).toFixed(1)}%</div>
                                </div>
                            )) : <div className="text-slate-500 text-xs">No data loaded</div>}
                        </div>
                    </section>

                    <section>
                        <div className="flex items-center gap-2 text-indigo-400 font-bold mb-3">
                            <History size={18} />
                            <h3 className="text-sm">Lineage</h3>
                        </div>
                        <div className="space-y-2">
                            {lineage.map((lin, i) => (
                                <div key={i} className="bg-slate-950 p-2 rounded border border-slate-800 text-[10px]">
                                    <div className="text-slate-300 truncate mb-1">{lin.path}</div>
                                    <div className="flex justify-between text-slate-500 font-mono">
                                        <span>{lin.start_commit_oid.slice(0, 7)}</span>
                                        <span>→</span>
                                        <span>{lin.end_commit_oid ? lin.end_commit_oid.slice(0, 7) : 'HEAD'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
