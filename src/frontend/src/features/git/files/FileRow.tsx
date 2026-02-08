/**
 * FileRow - Shared file row component for tree and table views
 */

import type { MouseEvent } from 'react';
import { FileIcon, FolderIcon } from 'lucide-react';

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
      </div>
    </div>
  );
}
