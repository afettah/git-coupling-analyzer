/**
 * FileContextMenu - Right-click context menu for files
 */

import { useEffect, useRef } from 'react';
import { Eye, ExternalLink, Copy } from 'lucide-react';

interface FileContextMenuProps {
  path: string;
  targetType?: 'file' | 'folder';
  x: number;
  y: number;
  onClose: () => void;
  onViewDetails?: () => void;
  onCopyPath?: () => void;
  onOpenInGit?: () => void;
  gitWebUrl?: string;
  gitProvider?: string;
  defaultBranch?: string;
}

export default function FileContextMenu({
  path,
  targetType = 'file',
  x,
  y,
  onClose,
  onViewDetails,
  onCopyPath,
  onOpenInGit,
  gitWebUrl,
  gitProvider,
  defaultBranch,
}: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const copyPath = () => {
    navigator.clipboard.writeText(path);
    onCopyPath?.();
  };

  const openInGit = () => {
    if (gitWebUrl && defaultBranch) {
      const isFolder = targetType === 'folder';
      let url = `${gitWebUrl}/${isFolder ? 'tree' : 'blob'}/${defaultBranch}/${path}`;

      if (gitProvider === 'gitlab') {
        url = `${gitWebUrl}/-/${isFolder ? 'tree' : 'blob'}/${defaultBranch}/${path}`;
      } else if (gitProvider === 'azure_devops') {
        url = `${gitWebUrl}?path=/${path}`;
      } else if (gitProvider === 'bitbucket') {
        url = `${gitWebUrl}/src/${defaultBranch}/${path}`;
      }

      window.open(url, '_blank');
    }
    onOpenInGit?.();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[200px]"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      {onViewDetails && (
        <button
          onClick={() => handleAction(onViewDetails)}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <Eye size={16} />
          View Details
        </button>
      )}

      <button
        onClick={() => handleAction(copyPath)}
        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
      >
        <Copy size={16} />
        Copy Path
      </button>

      {gitWebUrl && defaultBranch && (
        <>
          <div className="h-px bg-slate-700 my-1" />
          <button
            onClick={() => handleAction(openInGit)}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <ExternalLink size={16} />
            Open in {gitProvider || 'Git'}
          </button>
        </>
      )}
    </div>
  );
}
