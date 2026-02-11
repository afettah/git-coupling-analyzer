/**
 * TimelineChart - Reusable time-aware chart component with D3
 * Supports continuous time x-axis, zoom/pan, brush selection, auto-scaling
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  type TimelineChartProps,
  type TimeSeriesPoint,
  DEFAULT_CHART_MARGIN,
  DEFAULT_COLOR_SCHEME,
} from './types';

interface ParsedPoint extends Omit<TimeSeriesPoint, 'date'> {
  date: Date;
}

function domainsEqual(a: [Date, Date], b: [Date, Date]): boolean {
  return a[0].getTime() === b[0].getTime() && a[1].getTime() === b[1].getTime();
}

function getAutoScaleRange(points: TimeSeriesPoint[]): [Date, Date] {
  if (points.length === 0) {
    const now = new Date();
    return [new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), now];
  }

  const dates = points.map((p) => new Date(p.date)).sort((a, b) => a.getTime() - b.getTime());
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const now = new Date();
  const daysSinceLastActivity = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceLastActivity < 30) {
    return [new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), now];
  }
  if (daysSinceLastActivity < 90) {
    return [new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), now];
  }
  if (daysSinceLastActivity < 365) {
    return [new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), now];
  }

  const padding = (lastDate.getTime() - firstDate.getTime()) * 0.05;
  return [new Date(firstDate.getTime() - padding), new Date(lastDate.getTime() + padding)];
}

export default function TimelineChart({
  data,
  chartType,
  xDomain,
  yLabel = '',
  brushEnabled = false,
  zoomEnabled = true,
  onRangeChange,
  onPointClick,
  height = 300,
  colorScheme = DEFAULT_COLOR_SCHEME,
  className = '',
}: TimelineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });
  const [zoomDomain, setZoomDomain] = useState<[Date, Date] | null>(null);
  const clipPathId = useId().replace(/[:]/g, '');

  const parsedData = useMemo<ParsedPoint[]>(
    () =>
      data.map((d) => ({
        ...d,
        date: new Date(d.date),
      })),
    [data],
  );

  const autoDomain = useMemo<[Date, Date]>(() => getAutoScaleRange(parsedData), [parsedData]);
  const effectiveDomain: [Date, Date] = zoomDomain ?? xDomain ?? autoDomain;
  const isZoomed = !domainsEqual(effectiveDomain, autoDomain);

  useEffect(() => {
    if (xDomain) {
      setZoomDomain(null);
    }
  }, [xDomain]);

  useEffect(() => {
    if (!svgRef.current || parsedData.length === 0) {
      return;
    }

    const svg = d3.select(svgRef.current);
    const container = svgRef.current.parentElement;
    if (!container) return;

    const width = container.clientWidth;
    setDimensions({ width, height });

    svg.selectAll('*').remove();

    const margin = DEFAULT_CHART_MARGIN;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const [xMin, xMax] = effectiveDomain;

    const xScale = d3.scaleTime().domain([xMin, xMax]).range([0, innerWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(parsedData, (d) => d.value) || 1])
      .nice()
      .range([innerHeight, 0]);

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    g.append('defs')
      .append('clipPath')
      .attr('id', clipPathId)
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight);

    const chartContent = g.append('g').attr('clip-path', `url(#${clipPathId})`);
    const hasPointClick = typeof onPointClick === 'function';
    const dateFormatter = d3.timeFormat('%b %d, %Y');

    const clearTooltip = () => {
      d3.selectAll('.timeline-tooltip').remove();
    };

    const showTooltip = (event: MouseEvent, point: ParsedPoint) => {
      const metadataEntries = Object.entries(point.metadata ?? {})
        .slice(0, 4)
        .map(([key, value]) => `<div>${key}: ${String(value)}</div>`)
        .join('');

      d3.select('body')
        .append('div')
        .attr('class', 'timeline-tooltip')
        .style('position', 'absolute')
        .style('background', '#1e293b')
        .style('color', '#e2e8f0')
        .style('padding', '8px 12px')
        .style('border-radius', '6px')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('z-index', '1000')
        .style('border', '1px solid #334155')
        .html(`
          <div><strong>${dateFormatter(new Date(point.date))}</strong></div>
          <div>Value: ${point.value}</div>
          ${metadataEntries}
        `)
        .style('left', `${event.pageX + 10}px`)
        .style('top', `${event.pageY - 10}px`);
    };

    if (chartType === 'area' || chartType === 'stacked-area') {
      const areaGenerator = d3
        .area<ParsedPoint>()
        .x((d) => xScale(d.date))
        .y0(innerHeight)
        .y1((d) => yScale(d.value))
        .curve(d3.curveMonotoneX);

      chartContent
        .append('path')
        .datum(parsedData)
        .attr('fill', colorScheme[0])
        .attr('fill-opacity', 0.3)
        .attr('stroke', colorScheme[0])
        .attr('stroke-width', 2)
        .attr('d', areaGenerator);
    } else if (chartType === 'line') {
      const lineGenerator = d3
        .line<ParsedPoint>()
        .x((d) => xScale(d.date))
        .y((d) => yScale(d.value))
        .curve(d3.curveMonotoneX);

      chartContent
        .append('path')
        .datum(parsedData)
        .attr('fill', 'none')
        .attr('stroke', colorScheme[0])
        .attr('stroke-width', 2)
        .attr('d', lineGenerator);
    } else if (chartType === 'bar') {
      const barWidth = Math.max(2, innerWidth / Math.max(parsedData.length, 1) - 2);

      chartContent
        .selectAll('.bar')
        .data(parsedData)
        .join('rect')
        .attr('class', 'bar')
        .attr('x', (d) => xScale(d.date) - barWidth / 2)
        .attr('y', (d) => yScale(d.value))
        .attr('width', barWidth)
        .attr('height', (d) => innerHeight - yScale(d.value))
        .attr('fill', colorScheme[0])
        .attr('opacity', 0.8)
        .style('cursor', hasPointClick ? 'pointer' : 'default')
        .on('click', (_event, point) => onPointClick?.(point))
        .on('mouseenter', function (event, point) {
          d3.select(this).attr('opacity', 1);
          clearTooltip();
          showTooltip(event as MouseEvent, point);
        })
        .on('mouseleave', function () {
          d3.select(this).attr('opacity', 0.8);
          clearTooltip();
        });
    }

    if (chartType !== 'bar') {
      chartContent
        .selectAll('.point-hitbox')
        .data(parsedData)
        .join('circle')
        .attr('class', 'point-hitbox')
        .attr('cx', (d) => xScale(d.date))
        .attr('cy', (d) => yScale(d.value))
        .attr('r', 7)
        .attr('fill', 'transparent')
        .style('cursor', hasPointClick ? 'pointer' : 'default')
        .on('click', (_event, point) => onPointClick?.(point))
        .on('mouseenter', function (event, point) {
          clearTooltip();
          showTooltip(event as MouseEvent, point);
        })
        .on('mouseleave', clearTooltip);
    }

    const xAxis = d3.axisBottom(xScale).ticks(6).tickFormat(d3.timeFormat('%b %Y') as never);

    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .style('fill', '#94a3b8')
      .style('font-size', '11px');

    g.selectAll('.x-axis line, .x-axis path').style('stroke', '#334155');

    const yAxis = d3.axisLeft(yScale).ticks(5);

    g.append('g')
      .attr('class', 'y-axis')
      .call(yAxis)
      .selectAll('text')
      .style('fill', '#94a3b8')
      .style('font-size', '11px');

    g.selectAll('.y-axis line, .y-axis path').style('stroke', '#334155');

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

    if (zoomEnabled) {
      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, 50])
        .translateExtent([
          [0, 0],
          [innerWidth, innerHeight],
        ])
        .extent([
          [0, 0],
          [innerWidth, innerHeight],
        ])
        .on('zoom', (event) => {
          const newXScale = event.transform.rescaleX(xScale);

          chartContent.selectAll('path').attr('d', (d: unknown) => {
            if (chartType === 'area' || chartType === 'stacked-area') {
              return d3
                .area<ParsedPoint>()
                .x((row) => newXScale(row.date))
                .y0(innerHeight)
                .y1((row) => yScale(row.value))
                .curve(d3.curveMonotoneX)(d as ParsedPoint[]);
            }
            if (chartType === 'line') {
              return d3
                .line<ParsedPoint>()
                .x((row) => newXScale(row.date))
                .y((row) => yScale(row.value))
                .curve(d3.curveMonotoneX)(d as ParsedPoint[]);
            }
            return null;
          });

          chartContent
            .selectAll('.bar')
            .attr('x', (d: unknown) => newXScale((d as ParsedPoint).date) - (innerWidth / Math.max(parsedData.length, 1) - 2) / 2);

          g.select('.x-axis').call(xAxis.scale(newXScale) as never);
        });

      svg.call(zoom as never);
    }

    if (brushEnabled) {
      const brush = d3
        .brushX()
        .extent([
          [0, 0],
          [innerWidth, innerHeight],
        ])
        .on('end', (event) => {
          if (!event.selection) return;
          const [x0, x1] = event.selection as [number, number];
          if (Math.abs(x1 - x0) < 2) return;

          const brushed: [Date, Date] = [xScale.invert(Math.min(x0, x1)), xScale.invert(Math.max(x0, x1))];
          setZoomDomain(brushed);
          onRangeChange?.(brushed);
          d3.select(event.currentTarget as SVGGElement).call(brush.move as never, null);
        });

      g.append('g').attr('class', 'brush').call(brush);
    }
  }, [brushEnabled, chartType, clipPathId, colorScheme, effectiveDomain, height, onPointClick, onRangeChange, parsedData, yLabel, zoomEnabled]);

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

  useEffect(() => () => {
    d3.selectAll('.timeline-tooltip').remove();
  }, []);

  const handleResetZoom = () => {
    setZoomDomain(null);
    onRangeChange?.(autoDomain);
  };

  return (
    <div className={`timeline-chart relative max-w-full overflow-hidden ${className}`}>
      {isZoomed && (
        <button data-testid="timelinechart-btn-btn-1"
          type="button"
          onClick={handleResetZoom}
          className="absolute right-2 top-2 z-10 rounded-md border border-slate-600 bg-slate-900/85 px-2 py-1 text-[11px] text-slate-200 transition-colors hover:bg-slate-800"
        >
          Reset zoom
        </button>
      )}
      <svg ref={svgRef} className="block h-auto w-full max-w-full" aria-label="timeline-chart" />
    </div>
  );
}
