import type { GitRef } from '../api/git';

const MOCK_REFS: GitRef[] = [
  { name: 'main', kind: 'branch', short_sha: '9f3a2c1', date: '2026-02-10T10:00:00Z' },
  { name: 'develop', kind: 'branch', short_sha: '8b7d1fa', date: '2026-02-09T10:00:00Z' },
  { name: 'release/2026.01', kind: 'branch', short_sha: '7c8de20', date: '2026-01-31T08:12:00Z' },
  { name: 'feature/refactor-wizard', kind: 'branch', short_sha: 'ab45ef2', date: '2026-02-08T15:20:00Z' },
  { name: 'v1.0.0', kind: 'tag', short_sha: '12a4f92', date: '2025-12-20T12:00:00Z' },
  { name: 'v1.1.0', kind: 'tag', short_sha: '33bc019', date: '2026-01-25T12:00:00Z' },
];

export async function getMockGitRefs(
  _repoId: string,
  params?: { q?: string; kind?: 'branch' | 'tag' | 'all'; limit?: number }
): Promise<GitRef[]> {
  const q = params?.q?.trim().toLowerCase() ?? '';
  const kind = params?.kind ?? 'all';
  const limit = params?.limit ?? 50;

  let refs = MOCK_REFS;
  if (kind !== 'all') {
    refs = refs.filter((ref) => ref.kind === kind);
  }
  if (q) {
    refs = refs.filter((ref) => ref.name.toLowerCase().includes(q));
  }

  await new Promise((resolve) => setTimeout(resolve, 150));
  return refs.slice(0, limit);
}
