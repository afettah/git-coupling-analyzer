# Task 06 - Shared FileTree Component

## Objective

Create a reusable, high-performance FileTree for wizard/configurator/explorer with tri-state inclusion semantics.

## Dependencies

1. Task 02.

## Detailed Implementation

## 1) Create `src/frontend/src/shared/FileTree/`

Files:

1. `FileTree.tsx`
2. `TreeNode.tsx`
3. `useFileTree.ts`
4. `index.ts`

## 2) Component contract

```ts
interface FileTreeNode {
  path: string;
  name: string;
  kind: 'file' | 'dir';
  status?: 'included' | 'excluded' | 'partial';
  extension?: string;
  language?: string;
  children?: FileTreeNode[];
}

interface FileTreeProps {
  nodes: FileTreeNode[];
  selectable?: boolean;
  selectedPaths?: Set<string>;
  onSelectionChange?: (paths: Set<string>) => void;
  highlightPattern?: string;
  dimmedPaths?: Set<string>;
  virtualized?: boolean;
  height?: number;
}
```

## 3) Core behavior

1. flatten visible rows from expanded nodes.
2. support keyboard navigation.
3. support tri-state styling.
4. support optional row virtualization.

Flattening pseudocode:

```ts
function flatten(nodes, expanded, depth = 0): Row[] {
  const out: Row[] = [];
  for (const n of nodes) {
    out.push({ node: n, depth });
    if (n.kind === 'dir' && expanded.has(n.path)) {
      out.push(...flatten(n.children ?? [], expanded, depth + 1));
    }
  }
  return out;
}
```

## 4) Migration strategy

1. Introduce adapter from old `FolderTree` payload to new node model.
2. Replace files-tab rendering first.
3. Reuse same component in configurator live preview.
4. Remove old tree only after parity.

## Verification Matrix

1. 10k+ node render remains responsive.
2. expand/collapse updates are localized.
3. tri-state visual semantics are correct.
4. adapter path preserves current files-tab behavior.

## Definition of Done

1. Shared FileTree is production-usable in at least two screens.
2. Old tree is ready for retirement in cleanup phase.

## Files To Touch

1. `src/frontend/src/shared/FileTree/FileTree.tsx`
2. `src/frontend/src/shared/FileTree/TreeNode.tsx`
3. `src/frontend/src/shared/FileTree/useFileTree.ts`
4. `src/frontend/src/shared/FileTree/index.ts`
5. `src/frontend/src/features/git/FolderTree.tsx`
6. `src/frontend/src/features/dashboard/AnalysisDashboard.tsx`

