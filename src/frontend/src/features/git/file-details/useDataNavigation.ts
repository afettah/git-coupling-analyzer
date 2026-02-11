import { useCallback } from 'react';

export type DataActionType = 'navigate' | 'filter' | 'open-external' | 'show-tooltip';

export type FilterTarget =
  | 'author'
  | 'commits-search'
  | 'commits-date'
  | 'commits-period'
  | 'commits-weekday-hour';

export interface DataAction {
  type: DataActionType;
  target: string;
  payload?: unknown;
}

interface DataNavigationHandlers {
  onNavigate?: (target: string, payload?: unknown) => void;
  onFilter?: (target: FilterTarget, payload?: unknown) => void;
  onOpenExternal?: (target: string, payload?: unknown) => void;
  onShowTooltip?: (target: string, payload?: unknown) => void;
}

export function useDataNavigation(handlers: DataNavigationHandlers) {
  return useCallback(
    (action: DataAction) => {
      switch (action.type) {
        case 'navigate':
          handlers.onNavigate?.(action.target, action.payload);
          break;
        case 'filter':
          handlers.onFilter?.(action.target as FilterTarget, action.payload);
          break;
        case 'open-external':
          handlers.onOpenExternal?.(action.target, action.payload);
          break;
        case 'show-tooltip':
          handlers.onShowTooltip?.(action.target, action.payload);
          break;
      }
    },
    [handlers],
  );
}

export interface CommitDrilldown {
  mode: 'period' | 'date' | 'weekday-hour';
  granularity?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  period?: string;
  date?: string;
  weekday?: number;
  hour?: number;
  source?: string;
}

export function buildCommitUrl(
  gitWebUrl: string | undefined,
  provider: string | undefined,
  sha: string,
): string | null {
  if (!gitWebUrl) return null;

  switch (provider) {
    case 'github':
      return `${gitWebUrl}/commit/${sha}`;
    case 'gitlab':
      return `${gitWebUrl}/-/commit/${sha}`;
    case 'azure_devops':
      return `${gitWebUrl}/commit/${sha}`;
    case 'bitbucket':
      return `${gitWebUrl}/commits/${sha}`;
    default:
      return `${gitWebUrl}/commit/${sha}`;
  }
}
