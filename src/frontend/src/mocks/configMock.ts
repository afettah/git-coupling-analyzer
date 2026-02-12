import type { AnalysisStatus } from '../api/git';
import type { RepoInfo } from '../api/repos';
import {
  DEFAULT_GIT_ANALYSIS_CONFIG,
  normalizeGitAnalysisConfig,
  validateGitAnalysisConfig,
  type ConfigValidationResult,
  type GitAnalysisConfig,
} from '../features/settings/gitAnalysisConfig';

const CONFIG_PREFIX = 'mock-project-config:';
const REPO_PREFIX = 'mock-project-repo:';
const ANALYSIS_PREFIX = 'mock-project-analysis:';

export interface ProjectConfigRecord {
  repo_key: string;
  repo_path: string;
  config: GitAnalysisConfig;
  include_patterns: string[];
  exclude_patterns: string[];
  selected_paths: string[];
  created_at: string;
  updated_at: string;
}

function stableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

function repoStorageKey(repoId: string): string {
  return `${REPO_PREFIX}${repoId}`;
}

function configStorageKey(repoKey: string): string {
  return `${CONFIG_PREFIX}${repoKey}`;
}

function analysisStorageKey(repoId: string): string {
  return `${ANALYSIS_PREFIX}${repoId}`;
}

export function buildRepoId(repoPath: string): string {
  return `mock_repo_${stableHash(repoPath).slice(0, 10)}`;
}

export async function createMockRepo(payload: { path: string; name?: string }): Promise<RepoInfo> {
  const trimmedPath = payload.path.trim();
  const parts = trimmedPath.split('/').filter(Boolean);
  const fallbackName = parts[parts.length - 1] || 'project';
  const id = buildRepoId(trimmedPath);

  const repo: RepoInfo = {
    id,
    path: trimmedPath,
    name: payload.name?.trim() || fallbackName,
    state: 'ready',
    file_count: 0,
    commit_count: 0,
    last_analyzed: undefined,
  };

  window.localStorage.setItem(repoStorageKey(id), JSON.stringify(repo));
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(repo), 400);
  });
}

export function listMockRepos(): RepoInfo[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const repos: RepoInfo[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(REPO_PREFIX)) {
      continue;
    }

    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) || '') as RepoInfo;
      repos.push(parsed);
    } catch {
      // Ignore malformed entries.
    }
  }

  repos.sort((left, right) => left.name.localeCompare(right.name));
  return repos;
}

export function upsertMockRepo(repo: RepoInfo): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(repoStorageKey(repo.id), JSON.stringify(repo));
}

export function createProjectConfigRecord(input: {
  repoKey: string;
  repoPath: string;
  config?: Partial<GitAnalysisConfig>;
  includePatterns?: string[];
  excludePatterns?: string[];
  selectedPaths?: string[];
}): ProjectConfigRecord {
  const now = new Date().toISOString();

  return {
    repo_key: input.repoKey,
    repo_path: input.repoPath,
    config: normalizeGitAnalysisConfig(input.config ?? DEFAULT_GIT_ANALYSIS_CONFIG),
    include_patterns: input.includePatterns ?? [],
    exclude_patterns: input.excludePatterns ?? [],
    selected_paths: input.selectedPaths ?? [],
    created_at: now,
    updated_at: now,
  };
}

export async function createMockProjectConfig(record: ProjectConfigRecord): Promise<ProjectConfigRecord> {
  window.localStorage.setItem(configStorageKey(record.repo_key), JSON.stringify(record));
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(record), 180);
  });
}

export async function readMockProjectConfig(repoKey: string): Promise<ProjectConfigRecord | null> {
  const raw = window.localStorage.getItem(configStorageKey(repoKey));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ProjectConfigRecord;
  } catch {
    return null;
  }
}

export async function updateMockProjectConfig(
  repoKey: string,
  patch: Partial<Omit<ProjectConfigRecord, 'repo_key' | 'created_at'>>,
): Promise<ProjectConfigRecord> {
  const current = await readMockProjectConfig(repoKey);

  const base = current ?? createProjectConfigRecord({
    repoKey,
    repoPath: patch.repo_path ?? repoKey,
  });

  const next: ProjectConfigRecord = {
    ...base,
    ...patch,
    config: patch.config ? normalizeGitAnalysisConfig(patch.config) : base.config,
    updated_at: new Date().toISOString(),
  };

  window.localStorage.setItem(configStorageKey(repoKey), JSON.stringify(next));
  return next;
}

export function validateMockProjectConfig(config: GitAnalysisConfig): ConfigValidationResult {
  return validateGitAnalysisConfig(normalizeGitAnalysisConfig(config));
}

export function saveMockAnalysisStatus(repoId: string, status: AnalysisStatus): void {
  window.localStorage.setItem(analysisStorageKey(repoId), JSON.stringify(status));
}

export function loadMockAnalysisStatus(repoId: string): AnalysisStatus | null {
  const raw = window.localStorage.getItem(analysisStorageKey(repoId));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AnalysisStatus;
  } catch {
    return null;
  }
}
