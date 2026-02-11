/**
 * DayHourMatrix - Day × Hour activity heatmap
 * Shows when (day of week + hour) activity typically occurs
 */

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { type DayHourMatrixProps } from './types';

export default function DayHourMatrix({
  data,
  colorScheme = ['#0f172a', '#1e3a8a', '#3b82f6', '#60a5fa', '#93c5fd'],
  onCellClick,
  className = '',
}: DayHourMatrixProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    const cellSize = 24;
    const cellSpacing = 2;
    const labelWidth = 40;
    const labelHeight = 30;

    const width = labelWidth + hours.length * (cellSize + cellSpacing);
    const height = labelHeight + days.length * (cellSize + cellSpacing);

    svg.attr('width', width)
      .attr('height', height);

    // Create data map
    const dataMap = new Map<string, number>();
    let maxValue = 0;

    data.forEach(d => {
      const key = `${d.day}-${d.hour}`;
      dataMap.set(key, d.value);
      if (d.value > maxValue) maxValue = d.value;
    });

    // Color scale
    const colorScale = d3.scaleQuantize<string>()
      .domain([0, maxValue || 1])
      .range(colorScheme);

    // Day labels (Y-axis)
    svg.append('g')
      .selectAll('text')
      .data(days)
      .join('text')
      .attr('x', labelWidth - 8)
      .attr('y', (d, i) => labelHeight + i * (cellSize + cellSpacing) + cellSize / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .style('fill', '#64748b')
      .style('font-size', '11px')
      .style('font-weight', '500')
      .text(d => d);

    // Hour labels (X-axis)
    svg.append('g')
      .selectAll('text')
      .data(hours.filter(h => h % 3 === 0)) // Show every 3 hours
      .join('text')
      .attr('x', h => labelWidth + h * (cellSize + cellSpacing) + cellSize / 2)
      .attr('y', labelHeight - 8)
      .attr('text-anchor', 'middle')
      .style('fill', '#64748b')
      .style('font-size', '10px')
      .text(h => h.toString().padStart(2, '0'));

    // Create cells
    days.forEach((day, dayIdx) => {
      hours.forEach((hour, hourIdx) => {
        const key = `${dayIdx}-${hour}`;
        const value = dataMap.get(key) || 0;

        const cell = svg.append('rect')
          .attr('x', labelWidth + hourIdx * (cellSize + cellSpacing))
          .attr('y', labelHeight + dayIdx * (cellSize + cellSpacing))
          .attr('width', cellSize)
          .attr('height', cellSize)
          .attr('rx', 3)
          .attr('fill', value > 0 ? colorScale(value) : '#1e293b')
          .attr('opacity', value > 0 ? 1 : 0.3)
          .style('cursor', onCellClick ? 'pointer' : 'default')
          .attr('title', onCellClick ? 'Click to drill down to commits for this slot' : null);

        if (onCellClick) {
          cell.on('click', () => onCellClick(dayIdx, hour));
        }

        // Hover effects
        cell.on('mouseenter', function(event) {
          d3.select(this)
            .attr('stroke', '#60a5fa')
            .attr('stroke-width', 2);

          // Tooltip
          const tooltip = d3.select('body')
            .append('div')
            .attr('class', 'dayhour-tooltip')
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
              <div><strong>${day} ${hour.toString().padStart(2, '0')}:00</strong></div>
              <div>${value} ${value === 1 ? 'commit' : 'commits'}</div>
              ${onCellClick ? '<div style="margin-top:4px;color:#7dd3fc;">Click to view related commits</div>' : ''}
            `)
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`);
        });

        cell.on('mouseleave', function() {
          d3.select(this)
            .attr('stroke', null)
            .attr('stroke-width', 0);

          d3.selectAll('.dayhour-tooltip').remove();
        });
      });
    });

    // Legend
    const legendWidth = 150;
    const legendHeight = 15;
    const legendX = width - legendWidth - 10;
    const legendY = 10;

    const legendScale = d3.scaleLinear()
      .domain([0, maxValue || 1])
      .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
      .ticks(3)
      .tickFormat(d => d.toString());

    const legendGroup = svg.append('g')
      .attr('transform', `translate(${legendX}, ${legendY})`);

    // Legend gradient
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'legend-gradient')
      .attr('x1', '0%')
      .attr('x2', '100%');

    colorScheme.forEach((color, i) => {
      gradient.append('stop')
        .attr('offset', `${(i / (colorScheme.length - 1)) * 100}%`)
        .attr('stop-color', color);
    });

    legendGroup.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('rx', 3)
      .style('fill', 'url(#legend-gradient)');

    legendGroup.append('g')
      .attr('transform', `translate(0, ${legendHeight})`)
      .call(legendAxis)
      .selectAll('text')
      .style('fill', '#64748b')
      .style('font-size', '9px');

    legendGroup.selectAll('line, path')
      .style('stroke', '#334155');

    legendGroup.append('text')
      .attr('x', legendWidth / 2)
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .style('fill', '#64748b')
      .style('font-size', '10px')
      .text('Activity');

    return () => {
      d3.selectAll('.dayhour-tooltip').remove();
    };

  }, [data, colorScheme, onCellClick]);

  return (
    <div className={`dayhour-matrix ${className}`}>
      <svg ref={svgRef} />
    </div>
  );
}
