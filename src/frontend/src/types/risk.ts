// Risk scoring and analysis types

export interface RiskSignal {
    category: RiskCategory;
    severity: RiskSeverity;
    description: string;
    value?: number;
    threshold?: number;
}

export type RiskCategory =
    | 'coupling'
    | 'dependency'
    | 'churn'
    | 'semantic'
    | 'complexity'
    | 'ownership';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface RiskScore {
    entity_id: number;
    path: string;
    overall_risk: number;
    coupling_risk: number;
    dependency_risk: number;
    churn_risk: number;
    semantic_risk: number;
    signals: RiskSignal[];
    computed_at?: string;
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
    trend?: Array<{
        date: string;
        score: number;
    }>;
}

export interface FolderRisk {
    folder_path: string;
    file_count: number;
    avg_risk: number;
    max_risk: number;
    high_risk_files: number;
    medium_risk_files: number;
    low_risk_files: number;
}

// Helper to get risk color
export const getRiskColor = (score: number): string => {
    if (score >= 7) return '#ef4444'; // red-500
    if (score >= 5) return '#f97316'; // orange-500
    if (score >= 3) return '#eab308'; // yellow-500
    return '#22c55e'; // green-500
};

// Helper to get risk severity from score
export const getRiskSeverity = (score: number): RiskSeverity => {
    if (score >= 8) return 'critical';
    if (score >= 6) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
};

// Helper to get severity badge color
export const getSeverityBadgeColor = (severity: RiskSeverity): string => {
    switch (severity) {
        case 'critical':
            return 'bg-red-500/20 text-red-400 border-red-500/30';
        case 'high':
            return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
        case 'medium':
            return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        case 'low':
            return 'bg-green-500/20 text-green-400 border-green-500/30';
        default:
            return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
};

// Helper to get risk icon
export const getRiskIcon = (severity: RiskSeverity): string => {
    switch (severity) {
        case 'critical':
            return 'AlertOctagon';
        case 'high':
            return 'AlertTriangle';
        case 'medium':
            return 'AlertCircle';
        case 'low':
            return 'Info';
        default:
            return 'Circle';
    }
};

// Helper to format risk score
export const formatRiskScore = (score: number): string => {
    return score.toFixed(1);
};
