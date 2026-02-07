import { client } from './client';

// === Types ===

export interface IntelligenceDashboard {
    summary: {
        total_files: number;
        total_commits: number;
        total_authors: number;
        total_domains: number;
        overall_risk: number;
    };
    analyzers: Array<{
        type: string;
        name: string;
        last_run?: string;
        status: string;
    }>;
    top_risks: Array<{
        path: string;
        risk_score: number;
        primary_signal: string;
    }>;
    domain_overview: Array<{
        domain_id: number;
        domain_name: string;
        file_count: number;
        avg_risk: number;
    }>;
    trends?: {
        commits_over_time: Array<{ date: string; count: number }>;
        risk_over_time: Array<{ date: string; score: number }>;
    };
}

export interface ArchitectureMap {
    domains: Array<{
        domain_id: number;
        name: string;
        file_count: number;
        dependencies: number[];
    }>;
    cross_domain_coupling: Array<{
        source_domain: number;
        target_domain: number;
        coupling_strength: number;
        dependency_strength: number;
        combined_strength: number;
    }>;
}

export interface CouplingCorrelation {
    file_pairs: Array<{
        file_a: string;
        file_b: string;
        git_coupling: number;
        dependency_coupling: boolean;
        semantic_similarity: number;
        correlation_score: number;
        status: 'aligned' | 'structural_only' | 'logical_only' | 'conflicted';
    }>;
    summary: {
        total_pairs: number;
        aligned: number;
        structural_only: number;
        logical_only: number;
        conflicted: number;
    };
}

// === API Functions ===

export const getIntelligenceDashboard = (repoId: string) =>
    client.get<IntelligenceDashboard>(`/repos/${repoId}/intelligence/dashboard`).then(res => res.data);

export const getArchitectureMap = (repoId: string) =>
    client.get<ArchitectureMap>(`/repos/${repoId}/intelligence/architecture`).then(res => res.data);

export const getCorrelations = (repoId: string, options?: {
    min_git_coupling?: number;
    min_semantic_similarity?: number;
}) =>
    client.get<CouplingCorrelation>(`/repos/${repoId}/intelligence/correlations`, {
        params: options
    }).then(res => res.data);
