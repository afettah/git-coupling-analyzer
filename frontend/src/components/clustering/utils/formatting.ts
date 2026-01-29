/**
 * Formatting Utilities
 * 
 * Pure functions for formatting values for display.
 */

// ============================================================
// Number Formatting
// ============================================================

const numberFormatter = new Intl.NumberFormat();

/** Format a percentage value (0-1) as "XX%" */
export function formatPercent(value?: number): string {
    if (value === undefined || value === null) return '—';
    return `${Math.round(value * 100)}%`;
}

/** Format a number with locale-aware separators */
export function formatNumber(value?: number): string {
    if (value === undefined || value === null) return '—';
    return numberFormatter.format(value);
}

/** Format a large number in compact form (e.g., 1.2K, 3.4M) */
export function formatCompact(value?: number): string {
    if (value === undefined || value === null) return '—';
    if (value < 1000) return String(value);
    if (value < 1_000_000) return `${(value / 1000).toFixed(1)}K`;
    return `${(value / 1_000_000).toFixed(1)}M`;
}

// ============================================================
// Date/Time Formatting
// ============================================================

const dateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
});

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** Format an ISO date string to "Jan 1, 2024" */
export function formatDateShort(iso: string): string {
    try {
        return dateFormatter.format(new Date(iso));
    } catch {
        return iso;
    }
}

/** Format an ISO date string to "Jan 1, 2024, 3:45 PM" */
export function formatDateTime(iso: string): string {
    try {
        return dateTimeFormatter.format(new Date(iso));
    } catch {
        return iso;
    }
}

/** Format an ISO date string to relative time like "2 hours ago" */
export function relativeTime(iso: string): string {
    try {
        const date = new Date(iso);
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

        const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
            [60, 'second'],
            [60, 'minute'],
            [24, 'hour'],
            [7, 'day'],
            [4.345, 'week'],
            [12, 'month'],
            [Number.POSITIVE_INFINITY, 'year']
        ];

        let value = seconds;
        let unit: Intl.RelativeTimeFormatUnit = 'second';

        for (const [step, stepUnit] of units) {
            if (Math.abs(value) < step) {
                unit = stepUnit;
                break;
            }
            value /= step;
        }

        return relativeFormatter.format(-Math.round(value), unit);
    } catch {
        return iso;
    }
}

// ============================================================
// Path Formatting
// ============================================================

/** Extract the filename from a full path */
export function getFileName(path: string): string {
    return path.split('/').pop() || path;
}

/** Extract the file extension from a path */
export function getExtension(path: string): string {
    const filename = getFileName(path);
    const dotIndex = filename.lastIndexOf('.');
    return dotIndex > 0 ? filename.slice(dotIndex + 1) : '';
}

/** Get the folder path up to a certain depth */
export function getFolderPath(path: string, depth: number): string {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) return '';
    return parts.slice(0, Math.min(depth, parts.length - 1)).join('/');
}

/** Get the parent folder of a file */
export function getParentFolder(path: string): string {
    const parts = path.split('/').filter(Boolean);
    if (parts.length <= 1) return '';
    return parts.slice(0, -1).join('/');
}

/** Truncate a string with ellipsis if it exceeds maxLength */
export function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 2) + '..';
}

/** Truncate a path to show only first and last parts */
export function truncatePath(path: string, maxParts: number = 3): string {
    const parts = path.split('/').filter(Boolean);
    if (parts.length <= maxParts) return path;

    const start = parts.slice(0, Math.ceil(maxParts / 2));
    const end = parts.slice(-Math.floor(maxParts / 2));
    return [...start, '...', ...end].join('/');
}
