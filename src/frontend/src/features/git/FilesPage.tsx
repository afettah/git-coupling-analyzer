import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { getFileTree } from '@/api/git';
import FilesToolbar from './files/FilesToolbar';
import FilesTree from './files/FilesTree';
import FilesTable from './files/FilesTable';
import FileContextMenu from './files/FileContextMenu';
import { useFilesFilters } from './files/useFilesFilters';
import type { TreeNode, FlatFileNode } from './files/types';

interface FilesPageProps {
  repoId: string;
  onFileSelect?: (path: string) => void;
  onOpenDetails?: (path: string, type: 'file' | 'folder') => void;
  gitWebUrl?: string;
  gitProvider?: 'github' | 'gitlab' | 'azure_devops' | 'bitbucket' | null;
  defaultBranch?: string;
}

function flattenTree(tree: Record<string, TreeNode>): FlatFileNode[] {
  const files: FlatFileNode[] = [];

  const walk = (nodes: Record<string, TreeNode>, currentPath: string) => {
    Object.entries(nodes).forEach(([name, node]) => {
      const path = currentPath ? `${currentPath}/${name}` : name;
      const isDir = node.__type === 'dir' || !!node.__children;

      if (isDir) {
        walk(node.__children ?? {}, path);
        return;
      }

      const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() : undefined;
      const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      const commits = node.commits ?? 0;
      const authorsCount = node.authors ?? 0;
      const authors = node.last_author ? [node.last_author] : [];
      const churn = (node.lines_added ?? 0) + (node.lines_deleted ?? 0);
      const coupling = node.max_coupling ?? 0;
      const risk = Math.min(10, commits / 5 + coupling * 4 + Math.max(0, 3 - Math.min(authorsCount, 3)));

      files.push({
        name,
        path,
        extension,
        folder,
        commits,
        authors,
        authorsCount,
        churn,
        coupling,
        risk,
        lastChanged: node.last_modified,
        node,
      });
    });
  };

  walk(tree, '');
  return files;
}

export default function FilesPage({
  repoId,
  onFileSelect,
  onOpenDetails,
  gitWebUrl,
  gitProvider,
  defaultBranch,
}: FilesPageProps) {
  const [tree, setTree] = useState<Record<string, TreeNode>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    path: string;
    type: 'file' | 'folder';
  } | null>(null);

  const { filterTreeNode, filterAndSortFiles } = useFilesFilters();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const data = await getFileTree(repoId);
        if (!cancelled) {
          setTree(data);
          setExpanded(new Set(Object.keys(data).slice(0, 8)));
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load file tree', error);
          setLoadError('Failed to load files tree.');
          setTree({});
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [repoId]);

  const allFiles = useMemo(() => flattenTree(tree), [tree]);
  const fileMap = useMemo(() => new Map(allFiles.map(file => [file.path, file])), [allFiles]);
  const visibleFiles = useMemo<FlatFileNode[]>(
    () => filterAndSortFiles(allFiles),
    [allFiles, filterAndSortFiles],
  );
  const visiblePathSet = useMemo(() => new Set(visibleFiles.map(file => file.path)), [visibleFiles]);

  const isNodeVisible = useCallback(
    (node: TreeNode, path: string): boolean => {
      const isDir = node.__type === 'dir' || !!node.__children;

      if (!isDir) {
        return visiblePathSet.has(path) && filterTreeNode(node, path);
      }

      return Object.entries(node.__children ?? {}).some(([name, child]) => {
        const childPath = path ? `${path}/${name}` : name;
        return isNodeVisible(child, childPath);
      });
    },
    [visiblePathSet, filterTreeNode],
  );

  const handleToggleExpand = useCallback((path: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleSelectPath = useCallback(
    (path: string) => {
      setSelectedPath(path);
      onFileSelect?.(path);
    },
    [onFileSelect],
  );

  const handleContextMenu = useCallback((event: MouseEvent, path: string, type: 'file' | 'folder') => {
    event.preventDefault();
    setContextMenu({ open: true, x: event.clientX, y: event.clientY, path, type });
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading files...</div>;
  }

  if (loadError) {
    return <div className="p-6 text-sm text-red-400">{loadError}</div>;
  }

  return (
    <div className="h-full min-h-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-950 flex flex-col">
      <FilesToolbar
        totalFiles={allFiles.length}
        visibleFiles={visibleFiles.length}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showAdvanced={showAdvancedFilters}
        onToggleAdvanced={() => setShowAdvancedFilters(current => !current)}
      />

      <div className="min-h-0 flex-1 overflow-auto">
        {viewMode === 'tree' ? (
          <FilesTree
            tree={tree}
            expanded={expanded}
            onToggleExpand={handleToggleExpand}
            selectedPath={selectedPath}
            onSelectPath={handleSelectPath}
            onOpenDetails={onOpenDetails}
            onContextMenu={handleContextMenu}
            isNodeVisible={isNodeVisible}
            fileMap={fileMap}
          />
        ) : (
          <FilesTable
            files={visibleFiles}
            selectedPath={selectedPath}
            onSelectPath={handleSelectPath}
            onOpenDetails={onOpenDetails}
            onContextMenu={handleContextMenu}
          />
        )}
      </div>

      {contextMenu?.open && (
        <FileContextMenu
          path={contextMenu.path}
          targetType={contextMenu.type}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onViewDetails={() => onOpenDetails?.(contextMenu.path, contextMenu.type)}
          gitWebUrl={gitWebUrl}
          gitProvider={gitProvider ?? undefined}
          defaultBranch={defaultBranch}
        />
      )}
    </div>
  );
}
