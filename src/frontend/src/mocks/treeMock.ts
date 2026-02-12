import type { FileTreeNode, FileTreeNodeStatus } from '../shared/FileTree';

const EXTENSION_LANG: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript',
  js: 'JavaScript',
  py: 'Python',
  css: 'CSS',
  md: 'Markdown',
  json: 'JSON',
  yml: 'YAML',
  yaml: 'YAML',
};

function languageFromPath(path: string): string | undefined {
  const ext = path.includes('.') ? path.split('.').pop()?.toLowerCase() : undefined;
  if (!ext) {
    return undefined;
  }
  return EXTENSION_LANG[ext];
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function asDir(path: string, children: FileTreeNode[], status?: FileTreeNodeStatus): FileTreeNode {
  const parts = path.split('/');
  return {
    path,
    name: parts[parts.length - 1],
    kind: 'dir',
    status,
    children,
  };
}

function asFile(path: string, status: FileTreeNodeStatus = 'included'): FileTreeNode {
  const parts = path.split('/');
  const ext = path.includes('.') ? path.split('.').pop()?.toLowerCase() : undefined;
  return {
    path,
    name: parts[parts.length - 1],
    kind: 'file',
    status,
    extension: ext,
    language: languageFromPath(path),
  };
}

function buildGeneratedTree(): FileTreeNode {
  const domains: FileTreeNode[] = [];
  for (let domainIndex = 1; domainIndex <= 20; domainIndex += 1) {
    const domain = `domain-${String(domainIndex).padStart(2, '0')}`;
    const files: FileTreeNode[] = [];
    for (let fileIndex = 1; fileIndex <= 26; fileIndex += 1) {
      const fileName = `module-${String(fileIndex).padStart(2, '0')}.ts`;
      files.push(asFile(`src/generated/${domain}/${fileName}`));
    }
    domains.push(asDir(`src/generated/${domain}`, files, 'included'));
  }

  return asDir('src/generated', domains, 'included');
}

function baseTree(): FileTreeNode[] {
  return [
    asDir('src', [
      asDir('src/app', [
        asFile('src/app/main.tsx'),
        asFile('src/app/routes.tsx'),
        asFile('src/app/theme.css'),
      ]),
      asDir('src/features', [
        asDir('src/features/dashboard', [
          asFile('src/features/dashboard/Overview.tsx'),
          asFile('src/features/dashboard/Trends.tsx'),
        ]),
        asDir('src/features/git', [
          asFile('src/features/git/ImpactGraph.tsx'),
          asFile('src/features/git/FilesPage.tsx'),
        ]),
      ], 'partial'),
      buildGeneratedTree(),
    ], 'partial'),
    asDir('tests', [
      asFile('tests/test_config.py'),
      asFile('tests/test_pipeline.py'),
      asFile('tests/test_quality.py'),
    ], 'included'),
    asDir('docs', [
      asFile('docs/README.md'),
      asFile('docs/ARCHITECTURE.md'),
      asFile('docs/adr-001.md'),
    ], 'included'),
    asDir('node_modules', [
      asDir('node_modules/react', [
        asFile('node_modules/react/index.js', 'excluded'),
        asFile('node_modules/react/package.json', 'excluded'),
      ], 'excluded'),
      asDir('node_modules/lodash', [
        asFile('node_modules/lodash/index.js', 'excluded'),
      ], 'excluded'),
    ], 'excluded'),
  ];
}

function cloneNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    children: node.children ? cloneNodes(node.children) : undefined,
  }));
}

function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

function parsePatterns(patterns: string[]): RegExp[] {
  return patterns
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern.length > 0)
    .map((pattern) => wildcardToRegex(pattern));
}

function matchesAny(path: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(path));
}

function applyStatus(
  node: FileTreeNode,
  includePatterns: RegExp[],
  excludePatterns: RegExp[],
  signalFloor: number,
): FileTreeNodeStatus {
  if (node.kind === 'file') {
    const includedByPattern = includePatterns.length === 0 || matchesAny(node.path, includePatterns);
    const excludedByPattern = matchesAny(node.path, excludePatterns);
    const signalScore = stableHash(node.path) % 100;
    const excludedBySignal = signalScore < signalFloor;

    const status: FileTreeNodeStatus = includedByPattern && !excludedByPattern && !excludedBySignal
      ? 'included'
      : 'excluded';
    node.status = status;
    return status;
  }

  const childStatuses = (node.children ?? []).map((child) => applyStatus(child, includePatterns, excludePatterns, signalFloor));
  const unique = new Set(childStatuses);

  if (unique.size === 1) {
    node.status = childStatuses[0] ?? 'excluded';
  } else {
    node.status = 'partial';
  }

  return node.status;
}

export interface MockTreePreviewOptions {
  include_patterns: string[];
  exclude_patterns: string[];
  signal_floor?: number;
}

export async function getMockTree(): Promise<FileTreeNode[]> {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      resolve(cloneNodes(baseTree()));
    }, 420);
  });
}

export async function previewMockTree(options: MockTreePreviewOptions): Promise<FileTreeNode[]> {
  const includePatterns = parsePatterns(options.include_patterns);
  const excludePatterns = parsePatterns(options.exclude_patterns);
  const signalFloor = Math.max(0, Math.min(100, options.signal_floor ?? 0));

  return new Promise((resolve) => {
    window.setTimeout(() => {
      const tree = cloneNodes(baseTree());
      for (const root of tree) {
        applyStatus(root, includePatterns, excludePatterns, signalFloor);
      }
      resolve(tree);
    }, 280);
  });
}

export function collectLeafPathsByStatus(nodes: FileTreeNode[], status: FileTreeNodeStatus): Set<string> {
  const out = new Set<string>();

  const walk = (node: FileTreeNode) => {
    if (node.kind === 'file') {
      if (node.status === status) {
        out.add(node.path);
      }
      return;
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

export function collectPathsByStatus(nodes: FileTreeNode[], status: FileTreeNodeStatus): Set<string> {
  const out = new Set<string>();

  const walk = (node: FileTreeNode) => {
    if (node.status === status) {
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
