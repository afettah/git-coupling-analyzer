import { useMemo, useState, type MouseEvent } from 'react';
import TreeNode from './TreeNode';
import {
  collectPathsBySelectionState,
  resolveNodeStatus,
  useFileTree,
  type FileTreeNode,
  type FileTreeSelectionState,
} from './useFileTree';

const DEFAULT_HEIGHT = 420;
const ROW_HEIGHT = 32;
const OVER_SCAN = 8;

export interface FileTreeProps {
  nodes: FileTreeNode[];
  selectable?: boolean;
  selectedPaths?: Set<string>;
  onSelectionChange?: (paths: Set<string>) => void;
  expandedPaths?: Set<string>;
  onExpandedPathsChange?: (paths: Set<string>) => void;
  highlightPattern?: string;
  dimmedPaths?: Set<string>;
  virtualized?: boolean;
  height?: number;
  className?: string;
  onNodeClick?: (node: FileTreeNode) => void;
  onNodeOpen?: (node: FileTreeNode) => void;
  onNodeContextMenu?: (event: MouseEvent, node: FileTreeNode) => void;
}

export default function FileTree({
  nodes,
  selectable = false,
  selectedPaths,
  onSelectionChange,
  expandedPaths,
  onExpandedPathsChange,
  highlightPattern,
  dimmedPaths,
  virtualized = true,
  height = DEFAULT_HEIGHT,
  className,
  onNodeClick,
  onNodeOpen,
  onNodeContextMenu,
}: FileTreeProps) {
  const {
    rows,
    toggleExpanded,
    toggleSelected,
    getSelectionState,
    selectedPaths: effectiveSelectedPaths,
  } = useFileTree({
    nodes,
    selectable,
    selectedPaths,
    onSelectionChange,
    expandedPaths,
    onExpandedPathsChange,
  });

  const [scrollTop, setScrollTop] = useState(0);
  const [activePath, setActivePath] = useState<string | null>(null);

  const selectionCounts = useMemo(() => {
    const included = collectPathsBySelectionState(nodes, effectiveSelectedPaths, 'included').size;
    const partial = collectPathsBySelectionState(nodes, effectiveSelectedPaths, 'partial').size;
    return { included, partial };
  }, [nodes, effectiveSelectedPaths]);

  const { start, end, topPadding, bottomPadding } = useMemo(() => {
    if (!virtualized) {
      return {
        start: 0,
        end: rows.length,
        topPadding: 0,
        bottomPadding: 0,
      };
    }

    const visibleCount = Math.ceil(height / ROW_HEIGHT) + OVER_SCAN;
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVER_SCAN);
    const endIndex = Math.min(rows.length, startIndex + visibleCount);

    return {
      start: startIndex,
      end: endIndex,
      topPadding: startIndex * ROW_HEIGHT,
      bottomPadding: Math.max(0, (rows.length - endIndex) * ROW_HEIGHT),
    };
  }, [height, rows.length, scrollTop, virtualized]);

  const visibleRows = rows.slice(start, end);

  const handleArrowKey = (direction: 1 | -1) => {
    if (rows.length === 0) {
      return;
    }

    const currentIndex = activePath ? rows.findIndex((row) => row.node.path === activePath) : -1;
    const nextIndex = Math.min(rows.length - 1, Math.max(0, currentIndex + direction));
    setActivePath(rows[nextIndex].node.path);
  };

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/60 ${className ?? ''}`}>
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-500">
        <span>File Scope</span>
        {selectable && (
          <span>
            Included: <strong className="text-emerald-300">{selectionCounts.included}</strong>
            {selectionCounts.partial > 0 && (
              <>
                {' '}
                | Partial: <strong className="text-amber-300">{selectionCounts.partial}</strong>
              </>
            )}
          </span>
        )}
      </div>

      <div
        role="tree"
        tabIndex={0}
        style={{ height }}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            handleArrowKey(1);
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            handleArrowKey(-1);
          }
        }}
        className="overflow-auto p-2"
      >
        {topPadding > 0 && <div style={{ height: topPadding }} />}

        {visibleRows.map((row) => {
          const selectionState: FileTreeSelectionState = getSelectionState(row.node.path);
          const status = resolveNodeStatus(row.node, selectionState, selectable);

          return (
            <TreeNode
              key={row.node.path}
              node={row.node}
              depth={row.depth}
              hasChildren={row.hasChildren}
              isExpanded={row.isExpanded}
              isActive={activePath === row.node.path}
              selectable={selectable}
              selectionState={selectionState}
              status={status}
              highlightPattern={highlightPattern}
              dimmed={dimmedPaths?.has(row.node.path) ?? false}
              onToggleExpand={toggleExpanded}
              onToggleSelect={toggleSelected}
              onFocus={setActivePath}
              onClick={(node) => {
                setActivePath(node.path);
                onNodeClick?.(node);
              }}
              onOpen={onNodeOpen}
              onContextMenu={onNodeContextMenu}
            />
          );
        })}

        {bottomPadding > 0 && <div style={{ height: bottomPadding }} />}
      </div>
    </div>
  );
}
