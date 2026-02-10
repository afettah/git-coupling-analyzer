/**
 * FileRow - Shared file row component for tree and table views
 */

import type { MouseEvent } from 'react';
import { Copy, ExternalLink, FileIcon, FolderIcon } from 'lucide-react';
import { buildGitWebUrl, type GitProvider } from './gitWebUrl';

interface FileRowProps {
  path: string;
  type: 'file' | 'folder';
  commits?: number;
  authors?: number;
  risk?: number;
  lastChanged?: Date | string;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: MouseEvent) => void;
  isSelected?: boolean;
  className?: string;
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
  lastChanged,
  onClick,
  onDoubleClick,
  onContextMenu,
  isSelected = false,
  className = '',
  gitWebUrl,
  gitProvider,
  defaultBranch,
}: FileRowProps) {
  const Icon = type === 'folder' ? FolderIcon : FileIcon;
  const fileName = path.split('/').pop() || path;

  const getRiskColor = (score?: number) => {
    if (!score) return 'text-slate-500';
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

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'bg-sky-500/20 border border-sky-500/50'
          : 'hover:bg-slate-800/50'
      } ${className}`}
    >
      <Icon size={16} className={type === 'folder' ? 'text-sky-400' : 'text-slate-400'} />
      
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-200 truncate">{fileName}</div>
        {path !== fileName && (
          <div className="text-xs text-slate-500 truncate">{path}</div>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs">
        {commits !== undefined && (
          <span className="text-slate-400">{commits} commits</span>
        )}
        {authors !== undefined && (
          <span className="text-slate-400">{authors} {authors === 1 ? 'author' : 'authors'}</span>
        )}
        {risk !== undefined && (
          <span className={`font-medium ${getRiskColor(risk)}`}>
            risk: {risk.toFixed(1)}
          </span>
        )}
        {lastChanged && (
          <span className="text-slate-500">{formatDate(lastChanged)}</span>
        )}
        <button
          onClick={handleCopyPath}
          className="inline-flex items-center justify-center rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-700/60 hover:text-slate-200"
          title="Copy path"
          aria-label="Copy path"
        >
          <Copy size={14} />
        </button>
        <button
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
