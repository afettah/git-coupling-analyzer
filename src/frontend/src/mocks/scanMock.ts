export interface MockScanResult {
  scan_id: string;
  total_files: number;
  total_dirs: number;
  commit_count: number;
  languages: Record<string, number>;
  frameworks: string[];
  first_commit_date: string;
  last_commit_date: string;
}

const MOCK_SCAN_PROFILES: MockScanResult[] = [
  {
    scan_id: 'mock_scan_001',
    total_files: 1245,
    total_dirs: 98,
    commit_count: 4520,
    languages: { typescript: 342, python: 128, css: 45 },
    frameworks: ['react', 'fastapi'],
    first_commit_date: '2021-03-15',
    last_commit_date: '2026-02-10',
  },
  {
    scan_id: 'mock_scan_002',
    total_files: 8740,
    total_dirs: 421,
    commit_count: 142880,
    languages: { typescript: 5120, javascript: 1650, go: 430, yaml: 220 },
    frameworks: ['react', 'nextjs', 'node'],
    first_commit_date: '2018-06-01',
    last_commit_date: '2026-02-09',
  },
  {
    scan_id: 'mock_scan_003',
    total_files: 386,
    total_dirs: 42,
    commit_count: 740,
    languages: { python: 180, markdown: 67, yaml: 24 },
    frameworks: ['fastapi'],
    first_commit_date: '2024-01-10',
    last_commit_date: '2026-02-08',
  },
];

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickProfile(repoPath: string): MockScanResult {
  const profile = MOCK_SCAN_PROFILES[stableHash(repoPath) % MOCK_SCAN_PROFILES.length];
  return {
    ...profile,
    scan_id: `${profile.scan_id}_${stableHash(repoPath).toString(16).slice(0, 6)}`,
  };
}

export async function runMockScan(repoPath: string): Promise<MockScanResult> {
  const delayMs = 1200 + (stableHash(repoPath) % 900);
  const profile = pickProfile(repoPath);

  return new Promise((resolve) => {
    window.setTimeout(() => resolve(profile), delayMs);
  });
}
