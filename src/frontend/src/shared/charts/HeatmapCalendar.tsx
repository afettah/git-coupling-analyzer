/**
 * HeatmapCalendar - GitHub-style contribution calendar
 * Shows activity intensity over time in a calendar view
 */

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { type HeatmapCalendarProps } from './types';

export default function HeatmapCalendar({
  data,
  startDate,
  endDate,
  colorScheme = ['#0f172a', '#1e3a8a', '#3b82f6', '#60a5fa', '#93c5fd'],
  cellSize = 12,
  onDateClick,
  className = '',
}: HeatmapCalendarProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Parse dates
    const parsedData = data.map(d => ({
      date: new Date(d.date),
      value: d.value,
    }));

    // Determine date range
    const dates = parsedData.map(d => d.date);
    const minDate = startDate || d3.min(dates) || new Date();
    const maxDate = endDate || d3.max(dates) || new Date();

    // Create data map for quick lookup
    const dataMap = new Map(
      parsedData.map(d => [d.date.toISOString().split('T')[0], d.value])
    );

    // Generate all dates in range
    const allDates: Date[] = [];
    const current = new Date(minDate);
    while (current <= maxDate) {
      allDates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    // Group by week
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];
    
    // Pad start to begin on Sunday
    const startDay = allDates[0].getDay();
    for (let i = 0; i < startDay; i++) {
      currentWeek.push(new Date(allDates[0].getTime() - (startDay - i) * 24 * 60 * 60 * 1000));
    }

    allDates.forEach(date => {
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(date);
    });
    
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    const cellSpacing = 2;
    const width = weeks.length * (cellSize + cellSpacing);
    const height = 7 * (cellSize + cellSpacing) + 20;

    svg.attr('width', width)
      .attr('height', height);

    // Color scale
    const maxValue = d3.max(parsedData, d => d.value) || 1;
    const colorScale = d3.scaleQuantize<string>()
      .domain([0, maxValue])
      .range(colorScheme);

    // Day labels
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    svg.append('g')
      .selectAll('text')
      .data(dayLabels)
      .join('text')
      .attr('x', -5)
      .attr('y', (d, i) => i * (cellSize + cellSpacing) + cellSize / 2 + 20)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .style('fill', '#64748b')
      .style('font-size', '10px')
      .text(d => d.slice(0, 1));

    // Create cells
    weeks.forEach((week, weekIdx) => {
      const weekGroup = svg.append('g')
        .attr('transform', `translate(${weekIdx * (cellSize + cellSpacing)}, 20)`);

      week.forEach((date, dayIdx) => {
        const dateStr = date.toISOString().split('T')[0];
        const value = dataMap.get(dateStr) || 0;
        const isInRange = date >= minDate && date <= maxDate;

        weekGroup.append('rect')
          .attr('x', 0)
          .attr('y', dayIdx * (cellSize + cellSpacing))
          .attr('width', cellSize)
          .attr('height', cellSize)
          .attr('rx', 2)
          .attr('fill', isInRange ? colorScale(value) : '#1e293b')
          .attr('opacity', isInRange ? 1 : 0.3)
          .style('cursor', onDateClick ? 'pointer' : 'default')
          .attr('title', onDateClick ? 'Click to drill down to commits for this day' : null)
          .on('click', function() {
            if (onDateClick && isInRange) {
              onDateClick(date);
            }
          })
          .on('mouseenter', function(event) {
            d3.select(this)
              .attr('stroke', '#60a5fa')
              .attr('stroke-width', 1);

            // Tooltip
            const tooltip = d3.select('body')
              .append('div')
              .attr('class', 'heatmap-tooltip')
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
                <div><strong>${date.toLocaleDateString()}</strong></div>
                <div>${value} ${value === 1 ? 'commit' : 'commits'}</div>
                ${onDateClick ? '<div style="margin-top:4px;color:#7dd3fc;">Click to view related commits</div>' : ''}
              `)
              .style('left', `${event.pageX + 10}px`)
              .style('top', `${event.pageY - 10}px`);
          })
          .on('mouseleave', function() {
            d3.select(this)
              .attr('stroke', null)
              .attr('stroke-width', 0);

            d3.selectAll('.heatmap-tooltip').remove();
          });
      });
    });

    // Month labels
    const months = d3.timeMonths(minDate, maxDate);
    svg.append('g')
      .selectAll('text')
      .data(months)
      .join('text')
      .attr('x', d => {
        const weekIdx = d3.timeWeeks(minDate, d).length;
        return weekIdx * (cellSize + cellSpacing);
      })
      .attr('y', 12)
      .style('fill', '#64748b')
      .style('font-size', '10px')
      .text(d => d3.timeFormat('%b')(d));

    return () => {
      d3.selectAll('.heatmap-tooltip').remove();
    };

  }, [data, startDate, endDate, colorScheme, cellSize, onDateClick]);

  return (
    <div className={`heatmap-calendar ${className} overflow-x-auto`}>
      <svg ref={svgRef} />
    </div>
  );
}
