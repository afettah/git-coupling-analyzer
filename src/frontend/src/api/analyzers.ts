import { client } from './client';

// === Types ===

export interface AnalyzerInfo {
    type: string;
    name: string;
    description: string;
    available: boolean;
    last_run?: string;
    status?: TaskStatus;
}

export interface TaskStatus {
    task_id: string;
    analyzer_type: string;
    state: 'not_run' | 'pending' | 'running' | 'completed' | 'failed';
    stage?: string;
    progress?: number;
    started_at?: string;
    completed_at?: string;
    error?: string;
}

export interface TaskResult {
    task_id: string;
    success: boolean;
    result?: any;
    error?: string;
}

export interface RunAnalyzerRequest {
    config?: Record<string, any>;
}

export interface RunAnalyzerResponse {
    task_id: string;
    status: string;
}

// === API Functions ===

export const listAnalyzers = (repoId: string) =>
    client.get<AnalyzerInfo[]>(`/repos/${repoId}/analyzers`).then(res => res.data);

export const runAnalyzer = (repoId: string, type: string, config?: Record<string, any>) =>
    client.post<RunAnalyzerResponse>(
        `/repos/${repoId}/analyzers/run`,
        { analyzer_type: type, config: config || {} }
    ).then(res => res.data);

export const getAnalyzerStatus = (repoId: string, type: string) =>
    client.get<TaskStatus>(`/repos/${repoId}/analyzers/${type}/status`).then(res => res.data);

export const getTaskHistory = (repoId: string) =>
    client.get<TaskStatus[]>(`/repos/${repoId}/analyzers/tasks`).then(res => res.data);

export const getTask = (repoId: string, taskId: string) =>
    client.get<TaskStatus>(`/repos/${repoId}/analyzers/tasks/${taskId}`).then(res => res.data);
