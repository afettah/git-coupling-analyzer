/**
 * FileRow - Shared file row component for tree and table views
 */

import type { KeyboardEvent, MouseEvent } from 'react';
import { Copy, ExternalLink, FileIcon, FolderIcon, Flame, Anchor, Link2, AlertTriangle } from 'lucide-react';
import { buildGitWebUrl, type GitProvider } from './gitWebUrl';
import { matchesQuickFilter } from '@/shared/filters/FilterEngine';
import type { FileRowDisplayMode } from './types';

interface FileRowProps {
  path: string;
  type: 'file' | 'folder';
  commits?: number;
  authors?: number;
  risk?: number;
  churn?: number;
  coupling?: number;
  isHot?: boolean;
  isStable?: boolean;
  lastChanged?: Date | string;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: MouseEvent) => void;
  isSelected?: boolean;
  className?: string;
  displayMode?: FileRowDisplayMode;
  gitWebUrl?: string;
  gitProvider?: GitProvider | null;
  defaultBranch?: string;
}

export default function FileRow({
  path,
  type,
  commits,
  authors,
  risk,
  churn,
  coupling,
  isHot,
  isStable,
  lastChanged,
  onClick,
  onDoubleClick,
  onContextMenu,
  isSelected = false,
  className = '',
  displayMode = 'info',
  gitWebUrl,
  gitProvider,
  defaultBranch,
}: FileRowProps) {
  const Icon = type === 'folder' ? FolderIcon : FileIcon;
  const fileName = path.split('/').pop() || path;

  const getRiskColor = (score?: number) => {
    if (score === undefined || score === null) return 'text-slate-500';
    if (score >= 8) return 'text-red-400';
    if (score >= 6) return 'text-orange-400';
    if (score >= 4) return 'text-yellow-400';
    return 'text-green-400';
  };

  const formatDate = (date?: Date | string) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString();
  };

  const formattedRisk = risk !== undefined ? risk.toFixed(1) : 'n/a';
  const formattedChurn = churn !== undefined ? churn.toLocaleString() : 'n/a';
  const formattedCoupling = coupling !== undefined ? coupling.toFixed(2) : 'n/a';
  const formattedLastChanged = lastChanged ? formatDate(lastChanged) : 'n/a';

  const url = buildGitWebUrl({
    gitWebUrl,
    gitProvider,
    defaultBranch,
    path,
    targetType: type,
  });
  const missingOpenInGitReason = !gitWebUrl
    ? 'Missing git_web_url. Set a remote URL for this repository to enable this action.'
    : 'Missing default branch. Set git_default_branch to enable this action.';

  const handleCopyPath = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    void navigator.clipboard.writeText(path);
  };

  const handleOpenInGit = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (url) {
      window.open(url, '_blank');
    }
  };

  const quickFilterItem = {
    path,
    risk,
    churn,
    coupling,
    lastChanged,
    isHot,
    isStable,
  };

  const badgeStates = {
    hot: matchesQuickFilter(quickFilterItem, 'hot'),
    stable: matchesQuickFilter(quickFilterItem, 'stable'),
    coupled: matchesQuickFilter(quickFilterItem, 'coupled'),
    risky: matchesQuickFilter(quickFilterItem, 'risky'),
  };

  const interactionHint = onDoubleClick
    ? 'Click to select. Double-click to open details. Right-click for more actions.'
    : 'Click to select. Right-click for more actions.';

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (event.shiftKey && onDoubleClick) {
        onDoubleClick();
        return;
      }
      onClick?.();
    }
  };

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      title={interactionHint}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'bg-sky-500/20 border border-sky-500/50'
          : 'hover:bg-slate-800/50'
      } ${className}`}
    >
      <Icon size={16} className={type === 'folder' ? 'text-sky-400' : 'text-slate-400'} />
      
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-200 truncate hover:text-sky-300">{fileName}</div>
        {path !== fileName && (
          <div className="text-xs text-slate-500 truncate">{path}</div>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs">
        {type === 'file' && displayMode === 'icons' && (
          <div className="flex items-center gap-1.5">
            {badgeStates.hot && (
              <span title={`Hot file • churn: ${formattedChurn} • last changed: ${formattedLastChanged}`}>
                <Flame size={13} className="text-rose-400" />
              </span>
            )}
            {badgeStates.risky && (
              <span title={`Risky file • risk: ${formattedRisk} • coupling: ${formattedCoupling}`}>
                <AlertTriangle size={13} className="text-amber-400" />
              </span>
            )}
            {badgeStates.coupled && (
              <span title={`Highly coupled file • coupling: ${formattedCoupling} • risk: ${formattedRisk}`}>
                <Link2 size={13} className="text-cyan-400" />
              </span>
            )}
            {badgeStates.stable && (
              <span title={`Stable file • churn: ${formattedChurn} • last changed: ${formattedLastChanged}`}>
                <Anchor size={13} className="text-emerald-400" />
              </span>
            )}
          </div>
        )}
        {displayMode === 'info' && commits !== undefined && (
          <span className="text-slate-400">{commits} commits</span>
        )}
        {displayMode === 'info' && authors !== undefined && (
          <span className="text-slate-400">{authors} {authors === 1 ? 'author' : 'authors'}</span>
        )}
        {displayMode === 'info' && risk !== undefined && (
          <span className={`font-medium ${getRiskColor(risk)}`}>
            risk: {risk.toFixed(1)}
          </span>
        )}
        {displayMode === 'info' && lastChanged && (
          <span className="text-slate-500">{formatDate(lastChanged)}</span>
        )}
        <button data-testid="file-row-btn-copy-path"
          onClick={handleCopyPath}
          className="inline-flex items-center justify-center rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-700/60 hover:text-slate-200"
          title="Copy path"
          aria-label="Copy path"
        >
          <Copy size={14} />
        </button>
        <button data-testid="file-row-btn-open-in-git-provider"
          onClick={handleOpenInGit}
          disabled={!url}
          className={`inline-flex items-center justify-center rounded-md p-1 transition-colors ${
            url
              ? 'text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'
              : 'text-slate-600 cursor-not-allowed'
          }`}
          title={
            url
              ? 'Open in git provider'
              : missingOpenInGitReason
          }
          aria-label="Open in git provider"
        >
          <ExternalLink size={14} />
        </button>
      </div>
    </div>
  );
}
