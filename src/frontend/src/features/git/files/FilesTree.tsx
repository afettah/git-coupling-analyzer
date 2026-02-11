import { useMemo, type MouseEvent, type ReactNode } from 'react';
import FileRow from './FileRow';
import type { TreeNode, FlatFileNode } from './types';
import type { GitProvider } from './gitWebUrl';

interface FilesTreeProps {
  tree: Record<string, TreeNode>;
  expanded: Set<string>;
  onToggleExpand: (path: string) => void;
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
  onOpenDetails?: (path: string, type: 'file' | 'folder') => void;
  onContextMenu: (event: MouseEvent, path: string, type: 'file' | 'folder') => void;
  isNodeVisible: (node: TreeNode, path: string) => boolean;
  fileMap: Map<string, FlatFileNode>;
  gitWebUrl?: string;
  gitProvider?: GitProvider | null;
  defaultBranch?: string;
}

interface RenderNodeArgs {
  name: string;
  node: TreeNode;
  path: string;
  depth: number;
  expanded: Set<string>;
  onToggleExpand: (path: string) => void;
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
  onOpenDetails?: (path: string, type: 'file' | 'folder') => void;
  onContextMenu: (event: MouseEvent, path: string, type: 'file' | 'folder') => void;
  isNodeVisible: (node: TreeNode, path: string) => boolean;
  fileMap: Map<string, FlatFileNode>;
  gitWebUrl?: string;
  gitProvider?: GitProvider | null;
  defaultBranch?: string;
}

function renderNode({
  name,
  node,
  path,
  depth,
  expanded,
  onToggleExpand,
  selectedPath,
  onSelectPath,
  onOpenDetails,
  onContextMenu,
  isNodeVisible,
  fileMap,
  gitWebUrl,
  gitProvider,
  defaultBranch,
}: RenderNodeArgs): ReactNode {
  const fullPath = path ? `${path}/${name}` : name;
  const isDir = node.__type === 'dir' || !!node.__children;

  if (!isNodeVisible(node, fullPath)) {
    return null;
  }

  if (isDir) {
    const isExpanded = expanded.has(fullPath);
    const childEntries = Object.entries(node.__children ?? {}).sort(([left, leftNode], [right, rightNode]) => {
      const leftDir = leftNode.__type === 'dir' || !!leftNode.__children;
      const rightDir = rightNode.__type === 'dir' || !!rightNode.__children;
      if (leftDir && !rightDir) return -1;
      if (!leftDir && rightDir) return 1;
      return left.localeCompare(right);
    });

    return (
      <div key={fullPath}>
        <div className="flex items-center" style={{ paddingLeft: `${depth * 16}px` }}>
          <button data-testid="files-tree-btn-btn-1"
            onClick={() => onToggleExpand(fullPath)}
            className="w-5 text-xs text-slate-500 hover:text-slate-300"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▾' : '▸'}
          </button>
          <div className="flex-1">
            <FileRow
              path={fullPath}
              type="folder"
              onClick={() => {
                onSelectPath(fullPath);
                onToggleExpand(fullPath);
              }}
              onContextMenu={(event) => onContextMenu(event, fullPath, 'folder')}
              onDoubleClick={() => onOpenDetails?.(fullPath, 'folder')}
              isSelected={selectedPath === fullPath}
              className="py-1"
              gitWebUrl={gitWebUrl}
              gitProvider={gitProvider}
              defaultBranch={defaultBranch}
            />
          </div>
        </div>

        {isExpanded && (
          <div>
            {childEntries.map(([childName, childNode]) =>
              renderNode({
                name: childName,
                node: childNode,
                path: fullPath,
                depth: depth + 1,
                expanded,
                onToggleExpand,
                selectedPath,
                onSelectPath,
                onOpenDetails,
                onContextMenu,
                isNodeVisible,
                fileMap,
                gitWebUrl,
                gitProvider,
                defaultBranch,
              }),
            )}
          </div>
        )}
      </div>
    );
  }

  const file = fileMap.get(fullPath);

  return (
    <div key={fullPath} style={{ paddingLeft: `${depth * 16 + 20}px` }}>
      <FileRow
        path={fullPath}
        type="file"
        commits={file?.commits}
        authors={file?.authorsCount}
        risk={file?.risk}
        churn={file?.churn}
        coupling={file?.coupling}
        isHot={file?.isHot}
        isStable={file?.isStable}
        lastChanged={file?.lastChanged}
        onClick={() => onSelectPath(fullPath)}
        onDoubleClick={() => onOpenDetails?.(fullPath, 'file')}
        onContextMenu={(event) => onContextMenu(event, fullPath, 'file')}
        isSelected={selectedPath === fullPath}
        className="py-1"
        gitWebUrl={gitWebUrl}
        gitProvider={gitProvider}
        defaultBranch={defaultBranch}
      />
    </div>
  );
}

export default function FilesTree(props: FilesTreeProps) {
  const entries = useMemo(
    () =>
      Object.entries(props.tree).sort(([left, leftNode], [right, rightNode]) => {
        const leftDir = leftNode.__type === 'dir' || !!leftNode.__children;
        const rightDir = rightNode.__type === 'dir' || !!rightNode.__children;
        if (leftDir && !rightDir) return -1;
        if (!leftDir && rightDir) return 1;
        return left.localeCompare(right);
      }),
    [props.tree],
  );

  return (
    <div className="p-3 font-mono text-xs">
      {entries.map(([name, node]) =>
        renderNode({
          name,
          node,
          path: '',
          depth: 0,
          expanded: props.expanded,
          onToggleExpand: props.onToggleExpand,
          selectedPath: props.selectedPath,
          onSelectPath: props.onSelectPath,
          onOpenDetails: props.onOpenDetails,
          onContextMenu: props.onContextMenu,
          isNodeVisible: props.isNodeVisible,
          fileMap: props.fileMap,
          gitWebUrl: props.gitWebUrl,
          gitProvider: props.gitProvider,
          defaultBranch: props.defaultBranch,
        }),
      )}
    </div>
  );
}
