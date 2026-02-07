// Analyzer task and status types

export interface AnalyzerInfo {
    type: AnalyzerType;
    name: string;
    description: string;
    available: boolean;
    last_run?: string;
    status?: TaskStatus;
}

export type AnalyzerType = 'git' | 'deps' | 'semantic' | 'intelligence';

export interface TaskStatus {
    task_id: string;
    analyzer_type: AnalyzerType;
    state: TaskState;
    stage?: string;
    progress?: number;
    started_at?: string;
    completed_at?: string;
    error?: string;
    details?: Record<string, any>;
}

export type TaskState = 'not_run' | 'pending' | 'running' | 'completed' | 'failed';

export interface TaskResult {
    task_id: string;
    success: boolean;
    result?: any;
    error?: string;
    duration_ms?: number;
}

export interface AnalysisTask {
    task_id: string;
    repo_id: string;
    analyzer_type: AnalyzerType;
    config: Record<string, any>;
    state: TaskState;
    stage?: string;
    progress?: number;
    started_at?: string;
    completed_at?: string;
    error?: string;
}

// Helper to get task state color
export const getTaskStateColor = (state: TaskState): string => {
    switch (state) {
        case 'completed':
            return 'green';
        case 'running':
            return 'blue';
        case 'pending':
            return 'yellow';
        case 'failed':
            return 'red';
        case 'not_run':
            return 'gray';
        default:
            return 'gray';
    }
};

// Helper to get task state icon
export const getTaskStateIcon = (state: TaskState): string => {
    switch (state) {
        case 'completed':
            return 'CheckCircle';
        case 'running':
            return 'Loader';
        case 'pending':
            return 'Clock';
        case 'failed':
            return 'XCircle';
        case 'not_run':
            return 'Circle';
        default:
            return 'Circle';
    }
};
