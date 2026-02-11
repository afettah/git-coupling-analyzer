import type { MouseEvent } from 'react';
import FileRow from './FileRow';
import type { FlatFileNode, FileRowDisplayMode } from './types';
import type { GitProvider } from './gitWebUrl';

interface FilesTableProps {
  files: FlatFileNode[];
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
  onOpenDetails?: (path: string, type: 'file' | 'folder') => void;
  onContextMenu: (event: MouseEvent, path: string, type: 'file' | 'folder') => void;
  displayMode: FileRowDisplayMode;
  gitWebUrl?: string;
  gitProvider?: GitProvider | null;
  defaultBranch?: string;
}

export default function FilesTable({
  files,
  selectedPath,
  onSelectPath,
  onOpenDetails,
  onContextMenu,
  displayMode,
  gitWebUrl,
  gitProvider,
  defaultBranch,
}: FilesTableProps) {
  if (files.length === 0) {
    return <div className="p-6 text-center text-sm text-slate-500">No files match current filters.</div>;
  }

  return (
    <div className="p-3 space-y-1">
      {files.map((file) => (
        <FileRow
          key={file.path}
          path={file.path}
          type="file"
          commits={file.commits}
          authors={file.authorsCount}
          risk={file.risk}
          churn={file.churn}
          coupling={file.coupling}
          isHot={file.isHot}
          isStable={file.isStable}
          lastChanged={file.lastChanged}
          onClick={() => onSelectPath(file.path)}
          onDoubleClick={() => onOpenDetails?.(file.path, 'file')}
          onContextMenu={(event) => onContextMenu(event, file.path, 'file')}
          isSelected={selectedPath === file.path}
          displayMode={displayMode}
          gitWebUrl={gitWebUrl}
          gitProvider={gitProvider}
          defaultBranch={defaultBranch}
        />
      ))}
    </div>
  );
}
