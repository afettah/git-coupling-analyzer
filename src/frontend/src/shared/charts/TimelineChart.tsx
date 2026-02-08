/**
 * TimelineChart - Reusable time-aware chart component with D3
 * Supports continuous time x-axis, zoom/pan, brush selection, auto-scaling
 */

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  type TimelineChartProps,
  type TimeSeriesPoint,
  DEFAULT_CHART_MARGIN,
  DEFAULT_COLOR_SCHEME,
} from './types';

export default function TimelineChart({
  data,
  chartType,
  xDomain,
  yLabel = '',
  series = [],
  brushEnabled = false,
  zoomEnabled = true,
  onRangeChange,
  height = 300,
  colorScheme = DEFAULT_COLOR_SCHEME,
  className = '',
}: TimelineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const brushRef = useRef<SVGGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });

  // Auto-scale algorithm: detect optimal time window
  const getAutoScaleRange = (points: TimeSeriesPoint[]): [Date, Date] => {
    if (points.length === 0) {
      const now = new Date();
      return [new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), now];
    }

    const dates = points.map(p => new Date(p.date)).sort((a, b) => a.getTime() - b.getTime());
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const now = new Date();
    
    const daysSinceLastActivity = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

    // Auto-scale logic from design doc
    if (daysSinceLastActivity < 30) {
      // Show last 30 days
      return [new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), now];
    } else if (daysSinceLastActivity < 90) {
      // Show last 90 days
      return [new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), now];
    } else if (daysSinceLastActivity < 365) {
      // Show last 12 months
      return [new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), now];
    } else {
      // Show all time with padding
      const padding = (lastDate.getTime() - firstDate.getTime()) * 0.05;
      return [
        new Date(firstDate.getTime() - padding),
        new Date(lastDate.getTime() + padding),
      ];
    }
  };

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    const container = svgRef.current.parentElement;
    if (!container) return;

    const width = container.clientWidth;
    setDimensions({ width, height });

    // Clear previous content
    svg.selectAll('*').remove();

    const margin = DEFAULT_CHART_MARGIN;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Parse dates and prepare data
    const parsedData = data.map(d => ({
      ...d,
      date: new Date(d.date),
    }));

    // Determine x-axis domain
    const [xMin, xMax] = xDomain || getAutoScaleRange(parsedData);

    // Create scales
    const xScale = d3.scaleTime()
      .domain([xMin, xMax])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(parsedData, d => d.value) || 1])
      .nice()
      .range([innerHeight, 0]);

    // Create main group
    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add clip path
    g.append('defs')
      .append('clipPath')
      .attr('id', 'chart-clip')
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight);

    // Chart content group (will be clipped and zoomed)
    const chartContent = g.append('g')
      .attr('clip-path', 'url(#chart-clip)');

    // Draw chart based on type
    if (chartType === 'area' || chartType === 'stacked-area') {
      const areaGenerator = d3.area<{ date: Date; value: number }>()
        .x(d => xScale(d.date))
        .y0(innerHeight)
        .y1(d => yScale(d.value))
        .curve(d3.curveMonotoneX);

      chartContent.append('path')
        .datum(parsedData)
        .attr('fill', colorScheme[0])
        .attr('fill-opacity', 0.3)
        .attr('stroke', colorScheme[0])
        .attr('stroke-width', 2)
        .attr('d', areaGenerator);
    } else if (chartType === 'line') {
      const lineGenerator = d3.line<{ date: Date; value: number }>()
        .x(d => xScale(d.date))
        .y(d => yScale(d.value))
        .curve(d3.curveMonotoneX);

      chartContent.append('path')
        .datum(parsedData)
        .attr('fill', 'none')
        .attr('stroke', colorScheme[0])
        .attr('stroke-width', 2)
        .attr('d', lineGenerator);
    } else if (chartType === 'bar') {
      const barWidth = Math.max(2, innerWidth / parsedData.length - 2);

      chartContent.selectAll('.bar')
        .data(parsedData)
        .join('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.date) - barWidth / 2)
        .attr('y', d => yScale(d.value))
        .attr('width', barWidth)
        .attr('height', d => innerHeight - yScale(d.value))
        .attr('fill', colorScheme[0])
        .attr('opacity', 0.8);
    }

    // X-axis
    const xAxis = d3.axisBottom(xScale)
      .ticks(6)
      .tickFormat(d3.timeFormat('%b %Y') as any);

    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .style('fill', '#94a3b8')
      .style('font-size', '11px');

    g.selectAll('.x-axis line, .x-axis path')
      .style('stroke', '#334155');

    // Y-axis
    const yAxis = d3.axisLeft(yScale).ticks(5);

    g.append('g')
      .attr('class', 'y-axis')
      .call(yAxis)
      .selectAll('text')
      .style('fill', '#94a3b8')
      .style('font-size', '11px');

    g.selectAll('.y-axis line, .y-axis path')
      .style('stroke', '#334155');

    // Y-axis label
    if (yLabel) {
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -margin.left + 15)
        .attr('x', -innerHeight / 2)
        .attr('text-anchor', 'middle')
        .style('fill', '#94a3b8')
        .style('font-size', '12px')
        .text(yLabel);
    }

    // Zoom behavior
    if (zoomEnabled) {
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, 50])
        .translateExtent([[0, 0], [innerWidth, innerHeight]])
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on('zoom', (event) => {
          const newXScale = event.transform.rescaleX(xScale);
          chartContent.selectAll('path').attr('d', (d: any) => {
            if (chartType === 'area' || chartType === 'stacked-area') {
              return d3.area<{ date: Date; value: number }>()
                .x(d => newXScale(d.date))
                .y0(innerHeight)
                .y1(d => yScale(d.value))
                .curve(d3.curveMonotoneX)(d);
            } else if (chartType === 'line') {
              return d3.line<{ date: Date; value: number }>()
                .x(d => newXScale(d.date))
                .y(d => yScale(d.value))
                .curve(d3.curveMonotoneX)(d);
            }
            return null;
          });

          chartContent.selectAll('.bar')
            .attr('x', (d: any) => newXScale(d.date) - (innerWidth / parsedData.length - 2) / 2);

          g.select('.x-axis').call(xAxis.scale(newXScale) as any);
        });

      svg.call(zoom as any);
    }

    // Brush for range selection
    if (brushEnabled && brushRef.current) {
      const brush = d3.brushX()
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on('end', (event) => {
          if (!event.selection) return;
          const [x0, x1] = event.selection as [number, number];
          const range: [Date, Date] = [xScale.invert(x0), xScale.invert(x1)];
          onRangeChange?.(range);
        });

      const brushGroup = g.append('g')
        .attr('class', 'brush')
        .call(brush);
    }

  }, [data, chartType, xDomain, yLabel, height, brushEnabled, zoomEnabled, onRangeChange, colorScheme]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (svgRef.current?.parentElement) {
        setDimensions({
          width: svgRef.current.parentElement.clientWidth,
          height,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [height]);

  return (
    <div className={`timeline-chart ${className}`}>
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}
