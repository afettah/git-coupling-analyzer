export interface TreeNode {
  __type?: 'file' | 'dir';
  __children?: Record<string, TreeNode>;
  file_id?: number;
  commits?: number;
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
  lastChanged?: string;
  node: TreeNode;
}
