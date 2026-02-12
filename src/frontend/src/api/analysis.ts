import { client } from './client';

export interface ConfigRecord {
  id: string;
  repo_id: string;
  is_active: boolean;
  preset_id?: string | null;
  name: string;
  description: string;
  config: Record<string, unknown>;
  include_patterns: string[];
  exclude_patterns: string[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  field_errors: Record<string, string[]>;
  field_warnings: Record<string, string[]>;
}

export interface PresetOption {
  id: string;
  label: string;
  description: string;
  impact: string;
  config: Record<string, unknown>;
  recommendation_reason?: string | null;
}

export interface AnalysisRunResponse {
  run_id: string;
  state: string;
}

export interface AnalysisRunRecord {
  task_id: string;
  analyzer_type: string;
  state: string;
  progress: number;
  stage?: string;
  config_id?: string | null;
  entity_count?: number;
  relationship_count?: number;
  metrics?: Record<string, unknown>;
  started_at?: string | null;
  finished_at?: string | null;
  error?: string | null;
  created_at?: string | null;
}

export const createAnalysisConfig = (repoId: string, payload: {
  name: string;
  description?: string;
  preset_id?: string | null;
  config: Record<string, unknown>;
  include_patterns?: string[];
  exclude_patterns?: string[];
  is_active?: boolean;
}) => client.post<ConfigRecord>(`/repos/${repoId}/analysis/configs`, payload).then(res => res.data);

export const listAnalysisConfigs = (repoId: string) =>
  client.get<ConfigRecord[]>(`/repos/${repoId}/analysis/configs`).then(res => res.data);

export const getAnalysisConfig = (repoId: string, configId: string) =>
  client.get<ConfigRecord>(`/repos/${repoId}/analysis/configs/${configId}`).then(res => res.data);

export const updateAnalysisConfig = (repoId: string, configId: string, payload: Partial<{
  name: string;
  description: string;
  preset_id: string | null;
  config: Record<string, unknown>;
  include_patterns: string[];
  exclude_patterns: string[];
  is_active: boolean;
}>) => client.put<ConfigRecord>(`/repos/${repoId}/analysis/configs/${configId}`, payload).then(res => res.data);

export const deleteAnalysisConfig = (repoId: string, configId: string) =>
  client.delete(`/repos/${repoId}/analysis/configs/${configId}`).then(res => res.data);

export const activateAnalysisConfig = (repoId: string, configId: string) =>
  client.post(`/repos/${repoId}/analysis/configs/${configId}/activate`).then(res => res.data);

export const validateAnalysisConfig = (repoId: string, payload: {
  name?: string;
  description?: string;
  preset_id?: string | null;
  config: Record<string, unknown>;
  include_patterns?: string[];
  exclude_patterns?: string[];
  is_active?: boolean;
}) => client.post<ValidationResult>(`/repos/${repoId}/analysis/configs/validate`, payload).then(res => res.data);

export const getPresets = (repoId: string) =>
  client.get<PresetOption[]>(`/repos/${repoId}/presets`).then(res => res.data);

export const getPreset = (repoId: string, presetId: string) =>
  client.get<PresetOption>(`/repos/${repoId}/presets/${presetId}`).then(res => res.data);

export const runAnalysis = (repoId: string, payload: { config_id?: string }) =>
  client.post<AnalysisRunResponse>(`/repos/${repoId}/analysis/run`, payload).then(res => res.data);

export const listAnalysisRuns = (repoId: string) =>
  client.get<AnalysisRunRecord[]>(`/repos/${repoId}/analysis/runs`).then(res => res.data);

export const getAnalysisRun = (repoId: string, runId: string) =>
  client.get<AnalysisRunRecord>(`/repos/${repoId}/analysis/runs/${runId}`).then(res => res.data);

export const getAnalysisRunStreamUrl = (repoId: string, runId: string): string => {
  const baseUrl = (client.defaults.baseURL ?? '').replace(/\/$/, '');
  return `${baseUrl}/repos/${repoId}/analysis/runs/${runId}/stream`;
};
