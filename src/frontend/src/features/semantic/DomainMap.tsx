import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import { getDomains, type Domain } from '@/api/semantic';
import { Card } from '@/shared';
import { Loader } from 'lucide-react';

interface DomainMapProps {
    repoId: string;
}

export default function DomainMap({ repoId }: DomainMapProps) {
    const [domains, setDomains] = useState<Domain[]>([]);
    const [loading, setLoading] = useState(true);
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDomains = async () => {
            try {
                const data = await getDomains(repoId);
                setDomains(data);
            } catch (error) {
                console.error('Failed to fetch domains:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchDomains();
    }, [repoId]);

    useEffect(() => {
        if (!domains.length || !svgRef.current || !containerRef.current) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Clear previous content
        d3.select(svgRef.current).selectAll('*').remove();

        const svg = d3.select(svgRef.current)
            .attr('width', width)
            .attr('height', height);

        const colors = d3.scaleOrdinal(d3.schemeCategory10);

        // Create pack layout
        const pack = d3.pack<Domain>()
            .size([width - 40, height - 40])
            .padding(10);

        const root = d3.hierarchy({ children: domains } as any)
            .sum((d: any) => d.member_count || 0);

        pack(root);

        const g = svg.append('g')
            .attr('transform', 'translate(20, 20)');

        // Draw circles
        const nodes = g.selectAll('g')
            .data(root.children || [])
            .join('g')
            .attr('transform', (d: any) => `translate(${d.x},${d.y})`)
            .style('cursor', 'pointer')
            .on('click', (event, d: any) => {
                event.stopPropagation();
                navigate(`/repos/${repoId}/semantic/domains/${d.data.domain_id}`);
            });

        nodes.append('circle')
            .attr('r', (d: any) => d.r)
            .attr('fill', (_: any, i: number) => colors(i.toString()))
            .attr('fill-opacity', 0.2)
            .attr('stroke', (_: any, i: number) => colors(i.toString()))
            .attr('stroke-width', 2)
            .on('mouseenter', function () {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('fill-opacity', 0.4);
            })
            .on('mouseleave', function () {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('fill-opacity', 0.2);
            });

        // Add domain name
        nodes.append('text')
            .text((d: any) => d.data.label || d.data.name)
            .attr('text-anchor', 'middle')
            .attr('dy', '-0.5em')
            .attr('fill', '#fff')
            .attr('font-weight', 600)
            .attr('font-size', (d: any) => Math.min(d.r / 3, 16))
            .style('pointer-events', 'none');

        // Add member count
        nodes.append('text')
            .text((d: any) => `${d.data.member_count} files`)
            .attr('text-anchor', 'middle')
            .attr('dy', '1em')
            .attr('fill', '#94a3b8')
            .attr('font-size', (d: any) => Math.min(d.r / 5, 12))
            .style('pointer-events', 'none');

        // Add coherence score
        nodes.append('text')
            .text((d: any) => `${(d.data.coherence_score * 100).toFixed(0)}% coherent`)
            .attr('text-anchor', 'middle')
            .attr('dy', '2.5em')
            .attr('fill', '#64748b')
            .attr('font-size', (d: any) => Math.min(d.r / 6, 10))
            .style('pointer-events', 'none');

    }, [domains, navigate, repoId]);

    if (loading) {
        return (
            <Card className="flex-1 flex items-center justify-center">
                <Loader className="w-8 h-8 text-sky-500 animate-spin" />
            </Card>
        );
    }

    if (domains.length === 0) {
        return (
            <Card className="flex-1 flex items-center justify-center">
                <div className="text-center text-slate-400">
                    <p>No semantic domains discovered.</p>
                    <p className="text-sm mt-2">Run semantic analysis first.</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="flex-1 relative">
            <div ref={containerRef} className="absolute inset-0 p-6">
                <svg ref={svgRef} className="w-full h-full" />
            </div>
        </Card>
    );
}
