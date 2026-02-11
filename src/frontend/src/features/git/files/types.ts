export interface TreeNode {
  __type?: 'file' | 'dir';
  __children?: Record<string, TreeNode>;
  file_id?: number;
  commits?: number;
  total_commits?: number;
  first_commit_ts?: number;
  last_commit_ts?: number;
  commits_30d?: number;
  commits_90d?: number;
  lifetime_commits_per_month?: number;
  days_since_last_change?: number;
  is_hot?: boolean;
  is_stable?: boolean;
  is_unknown?: boolean;
  lines_added?: number;
  lines_deleted?: number;
  authors?: number;
  last_modified?: string;
  last_author?: string;
  coupled_count?: number;
  max_coupling?: number;
  avg_coupling?: number;
  strong_coupling_count?: number;
}

export interface FlatFileNode {
  name: string;
  path: string;
  extension?: string;
  folder?: string;
  commits: number;
  authors: string[];
  authorsCount: number;
  churn: number;
  coupling: number;
  risk: number;
  isHot: boolean;
  isStable: boolean;
  isUnknown: boolean;
  commits30d: number;
  commits90d: number;
  lifetimeCommitsPerMonth: number;
  daysSinceLastChange?: number;
  lastChanged?: string;
  node: TreeNode;
}

export type FileRowDisplayMode = 'icons' | 'info';
