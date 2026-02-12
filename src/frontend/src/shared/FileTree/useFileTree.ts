import { useCallback, useMemo, useState } from 'react';

export type FileTreeNodeStatus = 'included' | 'excluded' | 'partial';
export type FileTreeSelectionState = 'included' | 'excluded' | 'partial';

export interface FileTreeNode {
  path: string;
  name: string;
  kind: 'file' | 'dir';
  status?: FileTreeNodeStatus;
  extension?: string;
  language?: string;
  children?: FileTreeNode[];
}

export interface FileTreeRow {
  node: FileTreeNode;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

interface UseFileTreeOptions {
  nodes: FileTreeNode[];
  selectable?: boolean;
  selectedPaths?: Set<string>;
  onSelectionChange?: (paths: Set<string>) => void;
  expandedPaths?: Set<string>;
  onExpandedPathsChange?: (paths: Set<string>) => void;
}

const ROOT_EXPAND_DEPTH = 1;

function flattenVisibleRows(
  nodes: FileTreeNode[],
  expandedPaths: Set<string>,
  depth = 0,
): FileTreeRow[] {
  const rows: FileTreeRow[] = [];

  for (const node of nodes) {
    const hasChildren = node.kind === 'dir' && (node.children?.length ?? 0) > 0;
    const isExpanded = hasChildren ? expandedPaths.has(node.path) : false;
    rows.push({ node, depth, hasChildren, isExpanded });

    if (hasChildren && isExpanded) {
      rows.push(...flattenVisibleRows(node.children ?? [], expandedPaths, depth + 1));
    }
  }

  return rows;
}

function indexNodes(nodes: FileTreeNode[], out: Map<string, FileTreeNode>): void {
  for (const node of nodes) {
    out.set(node.path, node);
    if (node.kind === 'dir' && node.children) {
      indexNodes(node.children, out);
    }
  }
}

function collectDescendantFiles(node: FileTreeNode, out: string[]): void {
  if (node.kind === 'file') {
    out.push(node.path);
    return;
  }

  for (const child of node.children ?? []) {
    collectDescendantFiles(child, out);
  }
}

function collectDefaultExpanded(nodes: FileTreeNode[], depth: number, out: Set<string>): void {
  for (const node of nodes) {
    if (node.kind !== 'dir') {
      continue;
    }

    if (depth < ROOT_EXPAND_DEPTH) {
      out.add(node.path);
    }

    collectDefaultExpanded(node.children ?? [], depth + 1, out);
  }
}

function computeSelectionState(
  node: FileTreeNode,
  selectedPaths: Set<string>,
): FileTreeSelectionState {
  if (node.kind === 'file') {
    return selectedPaths.has(node.path) ? 'included' : 'excluded';
  }

  const children = node.children ?? [];
  if (children.length === 0) {
    return 'excluded';
  }

  let hasIncluded = false;
  let hasExcluded = false;

  for (const child of children) {
    const state = computeSelectionState(child, selectedPaths);
    if (state === 'partial') {
      return 'partial';
    }
    if (state === 'included') {
      hasIncluded = true;
    }
    if (state === 'excluded') {
      hasExcluded = true;
    }
    if (hasIncluded && hasExcluded) {
      return 'partial';
    }
  }

  if (hasIncluded && !hasExcluded) {
    return 'included';
  }

  return 'excluded';
}

export function useFileTree({
  nodes,
  selectable = false,
  selectedPaths,
  onSelectionChange,
  expandedPaths,
  onExpandedPathsChange,
}: UseFileTreeOptions) {
  const [internalSelectedPaths, setInternalSelectedPaths] = useState<Set<string>>(new Set());
  const [internalExpandedPaths, setInternalExpandedPaths] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    collectDefaultExpanded(nodes, 0, initial);
    return initial;
  });

  const nodeIndex = useMemo(() => {
    const index = new Map<string, FileTreeNode>();
    indexNodes(nodes, index);
    return index;
  }, [nodes]);

  const effectiveSelectedPaths = selectedPaths ?? internalSelectedPaths;
  const effectiveExpandedPaths = expandedPaths ?? internalExpandedPaths;

  const rows = useMemo(
    () => flattenVisibleRows(nodes, effectiveExpandedPaths),
    [nodes, effectiveExpandedPaths],
  );

  const toggleExpanded = useCallback((path: string) => {
    const update = (previous: Set<string>) => {
      const next = new Set(previous);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    };

    if (!expandedPaths) {
      setInternalExpandedPaths((previous) => update(previous));
      return;
    }

    onExpandedPathsChange?.(update(effectiveExpandedPaths));
  }, [effectiveExpandedPaths, expandedPaths, onExpandedPathsChange]);

  const setNextSelectedPaths = useCallback((next: Set<string>) => {
    if (!selectedPaths) {
      setInternalSelectedPaths(next);
    }
    onSelectionChange?.(new Set(next));
  }, [onSelectionChange, selectedPaths]);

  const toggleSelected = useCallback((path: string) => {
    if (!selectable) {
      return;
    }

    const node = nodeIndex.get(path);
    if (!node) {
      return;
    }

    const targets: string[] = [];
    collectDescendantFiles(node, targets);
    if (targets.length === 0) {
      return;
    }

    const next = new Set(effectiveSelectedPaths);
    const shouldSelectAny = targets.some((filePath) => !next.has(filePath));

    for (const filePath of targets) {
      if (shouldSelectAny) {
        next.add(filePath);
      } else {
        next.delete(filePath);
      }
    }

    setNextSelectedPaths(next);
  }, [effectiveSelectedPaths, nodeIndex, selectable, setNextSelectedPaths]);

  const getSelectionState = useCallback((path: string): FileTreeSelectionState => {
    const node = nodeIndex.get(path);
    if (!node) {
      return 'excluded';
    }
    return computeSelectionState(node, effectiveSelectedPaths);
  }, [nodeIndex, effectiveSelectedPaths]);

  const isPathSelected = useCallback((path: string): boolean => (
    effectiveSelectedPaths.has(path)
  ), [effectiveSelectedPaths]);

  return {
    rows,
    expandedPaths: effectiveExpandedPaths,
    toggleExpanded,
    toggleSelected,
    getSelectionState,
    isPathSelected,
    selectedPaths: effectiveSelectedPaths,
  };
}

export function resolveNodeStatus(
  node: FileTreeNode,
  selectionState: FileTreeSelectionState,
  selectable: boolean,
): FileTreeNodeStatus {
  if (selectable) {
    return selectionState;
  }

  if (node.status) {
    return node.status;
  }

  if (node.kind === 'file') {
    return 'included';
  }

  const childStatuses = new Set((node.children ?? []).map((child) => child.status ?? 'included'));
  if (childStatuses.size > 1) {
    return 'partial';
  }

  return childStatuses.has('excluded') ? 'excluded' : 'included';
}

export function collectPathsBySelectionState(
  nodes: FileTreeNode[],
  selectedPaths: Set<string>,
  targetState: FileTreeSelectionState,
): Set<string> {
  const out = new Set<string>();

  const walk = (node: FileTreeNode) => {
    const state = computeSelectionState(node, selectedPaths);
    if (state === targetState) {
      out.add(node.path);
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  };

  for (const node of nodes) {
    walk(node);
  }

  return out;
}
