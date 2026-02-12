import { type KeyboardEvent, type MouseEvent } from 'react';
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react';
import type { FileTreeNode, FileTreeNodeStatus, FileTreeSelectionState } from './useFileTree';

interface TreeNodeProps {
  node: FileTreeNode;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isActive: boolean;
  selectable: boolean;
  selectionState: FileTreeSelectionState;
  status: FileTreeNodeStatus;
  highlightPattern?: string;
  dimmed: boolean;
  onToggleExpand: (path: string) => void;
  onToggleSelect: (path: string) => void;
  onFocus: (path: string) => void;
  onClick?: (node: FileTreeNode) => void;
  onOpen?: (node: FileTreeNode) => void;
  onContextMenu?: (event: MouseEvent, node: FileTreeNode) => void;
}

const STATUS_STYLES: Record<FileTreeNodeStatus, string> = {
  included: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  excluded: 'border-rose-500/20 bg-rose-500/5 text-rose-200 opacity-70',
  partial: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
};

function highlightLabel(name: string, pattern?: string) {
  if (!pattern) {
    return name;
  }

  const normalized = pattern.trim().toLowerCase();
  if (!normalized) {
    return name;
  }

  const index = name.toLowerCase().indexOf(normalized);
  if (index < 0) {
    return name;
  }

  const before = name.slice(0, index);
  const match = name.slice(index, index + normalized.length);
  const after = name.slice(index + normalized.length);

  return (
    <>
      {before}
      <mark className="bg-sky-400/30 text-sky-100 rounded px-0.5">{match}</mark>
      {after}
    </>
  );
}

function handleKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  hasChildren: boolean,
  isExpanded: boolean,
  node: FileTreeNode,
  onToggleExpand: (path: string) => void,
  onToggleSelect: (path: string) => void,
) {
  if (event.key === 'ArrowRight' && hasChildren && !isExpanded) {
    event.preventDefault();
    onToggleExpand(node.path);
  }

  if (event.key === 'ArrowLeft' && hasChildren && isExpanded) {
    event.preventDefault();
    onToggleExpand(node.path);
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onToggleSelect(node.path);
  }
}

export default function TreeNode({
  node,
  depth,
  hasChildren,
  isExpanded,
  isActive,
  selectable,
  selectionState,
  status,
  highlightPattern,
  dimmed,
  onToggleExpand,
  onToggleSelect,
  onFocus,
  onClick,
  onOpen,
  onContextMenu,
}: TreeNodeProps) {
  const indentPx = depth * 16;
  const languageBadge = node.kind === 'file' ? (node.language ?? node.extension) : undefined;

  return (
    <div
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isActive}
      tabIndex={0}
      onFocus={() => onFocus(node.path)}
      onClick={() => {
        onToggleSelect(node.path);
        onClick?.(node);
      }}
      onDoubleClick={() => onOpen?.(node)}
      onContextMenu={(event) => onContextMenu?.(event, node)}
      onKeyDown={(event) => handleKeyDown(event, hasChildren, isExpanded, node, onToggleExpand, onToggleSelect)}
      className={`group flex h-8 items-center rounded-md border px-2 text-xs transition-colors outline-none ${STATUS_STYLES[status]} ${
        isActive ? 'ring-1 ring-sky-400/50' : ''
      } ${dimmed ? 'opacity-50' : ''}`}
      style={{ marginLeft: indentPx }}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (hasChildren) {
            onToggleExpand(node.path);
          }
        }}
        className="mr-1 inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-100"
        aria-label={hasChildren ? (isExpanded ? 'Collapse folder' : 'Expand folder') : 'File'}
      >
        {hasChildren ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-3" />}
      </button>

      {selectable && (
        <input
          type="checkbox"
          checked={selectionState === 'included'}
          ref={(input) => {
            if (input) {
              input.indeterminate = selectionState === 'partial';
            }
          }}
          onChange={() => onToggleSelect(node.path)}
          onClick={(event) => event.stopPropagation()}
          className="mr-2 h-3.5 w-3.5 rounded border-slate-600 bg-slate-800"
        />
      )}

      <div className="mr-2 text-slate-200">
        {hasChildren ? (
          isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />
        ) : (
          <FileText size={14} />
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate">{highlightLabel(node.name, highlightPattern)}</span>
        {languageBadge && (
          <span className="rounded border border-slate-600/60 bg-slate-900/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
            {languageBadge}
          </span>
        )}
      </div>
    </div>
  );
}
