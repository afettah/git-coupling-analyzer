import type { RepoInfo, ScanSummary } from '../../api/repos';
import type { ConfigValidationResult, GitAnalysisConfig } from '../settings/gitAnalysisConfig';
import type { FileTreeNode } from '../../shared/FileTree';

export type WizardStep = 'repository' | 'scan' | 'preset' | 'configure' | 'review';

export interface RepositoryDraft {
  path: string;
  name: string;
}

export interface PresetOption {
  id: string;
  label: string;
  description: string;
  impact: string;
  changed_fields: string[];
  recommendation_reason?: string | null;
}

export interface PresetRecommendation {
  preset_id: string;
  reasons: string[];
}

export interface RunProgressEvent {
  state: string;
  stage: string;
  progress: number;
  processed_commits: number;
  total_commits: number;
  entity_count: number;
  relationship_count: number;
  elapsed_seconds: number;
  error?: string | null;
}

export interface WizardState {
  repo: RepoInfo | null;
  scan: ScanSummary | null;
  presetOptions: PresetOption[];
  recommendation: PresetRecommendation | null;
  selectedPresetId: string;
  smartDefaults: GitAnalysisConfig;
  config: GitAnalysisConfig;
  includePatterns: string[];
  excludePatterns: string[];
  treeNodes: FileTreeNode[];
  selectedPaths: Set<string>;
  validation: ConfigValidationResult;
  progress: RunProgressEvent | null;
}
