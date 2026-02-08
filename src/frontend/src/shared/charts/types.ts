/**
 * Shared chart type definitions for time-aware visualizations
 */

export interface TimeSeriesPoint {
  date: string | Date;
  value: number;
  series?: string;
  metadata?: Record<string, any>;
}

export interface SeriesConfig {
  id: string;
  label: string;
  color?: string;
  visible?: boolean;
}

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface NumberRange {
  min: number | null;
  max: number | null;
}

export type ChartType = 'area' | 'bar' | 'line' | 'stacked-area';

export interface TimelineChartProps {
  data: TimeSeriesPoint[];
  chartType: ChartType;
  xDomain?: [Date, Date];
  yLabel?: string;
  series?: SeriesConfig[];
  brushEnabled?: boolean;
  zoomEnabled?: boolean;
  onRangeChange?: (range: [Date, Date]) => void;
  height?: number;
  colorScheme?: string[];
  className?: string;
}

export interface HeatmapCalendarProps {
  data: Array<{ date: string | Date; value: number }>;
  startDate?: Date;
  endDate?: Date;
  colorScheme?: string[];
  cellSize?: number;
  onDateClick?: (date: Date) => void;
  className?: string;
}

export interface DayHourMatrixProps {
  data: Array<{ day: number; hour: number; value: number }>;
  colorScheme?: string[];
  onCellClick?: (day: number, hour: number) => void;
  className?: string;
}

export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_CHART_MARGIN: ChartMargin = {
  top: 20,
  right: 30,
  bottom: 40,
  left: 50,
};

export const DEFAULT_COLOR_SCHEME = [
  '#0ea5e9', // sky-500
  '#6366f1', // indigo-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#ef4444', // red-500
  '#06b6d4', // cyan-500
];
