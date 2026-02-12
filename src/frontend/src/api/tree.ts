import { client } from './client';

export interface TreeNode {
  path: string;
  name: string;
  kind: 'file' | 'dir';
  status?: 'included' | 'excluded' | 'partial' | null;
  extension?: string | null;
  language?: string | null;
  children?: TreeNode[];
}

export interface TreePreviewRequest {
  include_patterns?: string[];
  exclude_patterns?: string[];
  extensions_include?: string[];
  extensions_exclude?: string[];
  max_depth?: number;
}

export const getTree = (repoId: string, params?: {
  path?: string;
  depth?: number;
  include_files?: boolean;
}) => client.get<TreeNode[]>(`/repos/${repoId}/tree`, { params }).then(res => res.data);

export const previewTree = (repoId: string, payload: TreePreviewRequest) =>
  client.post<TreeNode[]>(`/repos/${repoId}/tree/preview`, payload).then(res => res.data);
