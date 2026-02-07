import { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import { getImportGraph, type ImportGraph as ImportGraphType, type ImportGraphNode } from '@/api/deps';
import { Card } from '@/shared';
import { Loader } from 'lucide-react';

interface ImportGraphProps {
    repoId: string;
    onNodeClick?: (node: ImportGraphNode) => void;
}

export default function ImportGraph({ repoId, onNodeClick }: ImportGraphProps) {
    const [graph, setGraph] = useState<ImportGraphType | null>(null);
    const [loading, setLoading] = useState(true);
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchGraph = async () => {
            try {
                const data = await getImportGraph(repoId, { includeExternal: false });
                setGraph(data);
            } catch (error) {
                console.error('Failed to fetch import graph:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchGraph();
    }, [repoId]);

    useEffect(() => {
        if (!graph || !svgRef.current || !containerRef.current) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Clear previous content
        d3.select(svgRef.current).selectAll('*').remove();

        const svg = d3.select(svgRef.current)
            .attr('width', width)
            .attr('height', height);

        const g = svg.append('g');

        // Add zoom behavior
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);

        // Create simulation
        const simulation = d3.forceSimulation(graph.nodes as any)
            .force('link', d3.forceLink(graph.edges)
                .id((d: any) => d.id)
                .distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(30));

        // Draw edges
        const link = g.append('g')
            .selectAll('line')
            .data(graph.edges)
            .join('line')
            .attr('stroke', d => d.is_dynamic ? '#f59e0b' : '#10b981')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 2)
            .attr('marker-end', 'url(#arrowhead)');

        // Add arrow marker
        svg.append('defs').append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '-0 -5 10 10')
            .attr('refX', 20)
            .attr('refY', 0)
            .attr('orient', 'auto')
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .append('path')
            .attr('d', 'M 0,-5 L 10,0 L 0,5')
            .attr('fill', '#10b981');

        // Draw nodes
        const node = g.append('g')
            .selectAll('circle')
            .data(graph.nodes)
            .join('circle')
            .attr('r', 8)
            .attr('fill', d => d.is_external ? '#ef4444' : '#3b82f6')
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                event.stopPropagation();
                onNodeClick?.(d);
            })
            .call(d3.drag<any, any>()
                .on('start', (event, d: any) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on('drag', (event, d: any) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on('end', (event, d: any) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                }));

        // Add labels
        const label = g.append('g')
            .selectAll('text')
            .data(graph.nodes)
            .join('text')
            .text(d => d.name)
            .attr('font-size', 10)
            .attr('fill', '#94a3b8')
            .attr('text-anchor', 'middle')
            .attr('dy', -12)
            .style('pointer-events', 'none');

        // Update positions on tick
        simulation.on('tick', () => {
            link
                .attr('x1', (d: any) => d.source.x)
                .attr('y1', (d: any) => d.source.y)
                .attr('x2', (d: any) => d.target.x)
                .attr('y2', (d: any) => d.target.y);

            node
                .attr('cx', (d: any) => d.x)
                .attr('cy', (d: any) => d.y);

            label
                .attr('x', (d: any) => d.x)
                .attr('y', (d: any) => d.y);
        });

        // Cleanup
        return () => {
            simulation.stop();
        };
    }, [graph, onNodeClick]);

    if (loading) {
        return (
            <Card className="flex-1 flex items-center justify-center">
                <Loader className="w-8 h-8 text-sky-500 animate-spin" />
            </Card>
        );
    }

    if (!graph || graph.nodes.length === 0) {
        return (
            <Card className="flex-1 flex items-center justify-center">
                <div className="text-center text-slate-400">
                    <p>No import graph data available.</p>
                    <p className="text-sm mt-2">Run dependency analysis first.</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="flex-1 relative">
            <div ref={containerRef} className="absolute inset-0">
                <svg ref={svgRef} className="w-full h-full" />
            </div>
            <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur-sm border border-slate-800 rounded-lg p-3 text-xs">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-slate-300">Internal file</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-slate-300">External package</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-0.5 bg-green-500" />
                        <span className="text-slate-300">Static import</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-0.5 bg-amber-500" />
                        <span className="text-slate-300">Dynamic import</span>
                    </div>
                </div>
            </div>
        </Card>
    );
}
