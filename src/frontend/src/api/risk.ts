import { client } from './client';

// === Types ===

export interface RiskSignal {
    category: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
    value?: number;
}

export interface RiskScore {
    entity_id: number;
    path: string;
    overall_risk: number;
    coupling_risk: number;
    dependency_risk: number;
    churn_risk: number;
    semantic_risk: number;
    signals: RiskSignal[];
}

export interface RiskOverview {
    overall_score: number;
    category_scores: {
        coupling: number;
        dependency: number;
        churn: number;
        semantic: number;
    };
    high_risk_count: number;
    medium_risk_count: number;
    low_risk_count: number;
    distribution: Array<{
        bucket: string;
        count: number;
    }>;
}

export interface FolderRisk {
    folder_path: string;
    file_count: number;
    avg_risk: number;
    max_risk: number;
    high_risk_files: number;
}

// === API Functions ===

export const getRiskOverview = (repoId: string) =>
    client.get<RiskOverview>(`/repos/${repoId}/risk/overview`).then(res => res.data);

export const getRiskFiles = (repoId: string, filters?: {
    min_risk?: number;
    max_risk?: number;
    folder?: string;
    sort_by?: 'overall_risk' | 'coupling_risk' | 'dependency_risk' | 'churn_risk';
    order?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}) =>
    client.get<RiskScore[]>(`/repos/${repoId}/risk/files`, { params: filters }).then(res => res.data);

export const getRiskFolders = (repoId: string) =>
    client.get<FolderRisk[]>(`/repos/${repoId}/risk/folders`).then(res => res.data);
