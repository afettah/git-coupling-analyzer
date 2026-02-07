import { client } from './client';

// === Types ===

export interface Domain {
    domain_id: number;
    name: string;
    label?: string;
    description?: string;
    coherence_score: number;
    member_count: number;
    top_terms: string[];
}

export interface DomainDetail extends Domain {
    files: Array<{
        path: string;
        score: number;
    }>;
    cross_coupling?: Array<{
        domain_id: number;
        domain_name: string;
        coupling_strength: number;
    }>;
}

export interface FileClassification {
    file_path: string;
    primary_domain?: {
        domain_id: number;
        domain_name: string;
        score: number;
    };
    all_domains: Array<{
        domain_id: number;
        domain_name: string;
        score: number;
    }>;
}

export interface SimilarFile {
    path: string;
    similarity_score: number;
    shared_terms: string[];
}

export interface FileTokens {
    file_path: string;
    tokens: Array<{
        token: string;
        frequency: number;
        is_business: boolean;
    }>;
}

export interface BridgeEntity {
    path: string;
    domain_count: number;
    domains: Array<{
        domain_id: number;
        domain_name: string;
        score: number;
    }>;
}

// === API Functions ===

export const getDomains = (repoId: string) =>
    client.get<Domain[]>(`/repos/${repoId}/semantic/domains`).then(res => res.data);

export const getDomain = (repoId: string, domainId: number) =>
    client.get<DomainDetail>(`/repos/${repoId}/semantic/domains/${domainId}`).then(res => res.data);

export const classifyFile = (repoId: string, filePath: string) =>
    client.get<FileClassification>(
        `/repos/${repoId}/semantic/files/${encodeURIComponent(filePath)}/classify`
    ).then(res => res.data);

export const getSimilarFiles = (repoId: string, filePath: string, limit: number = 10) =>
    client.get<SimilarFile[]>(
        `/repos/${repoId}/semantic/files/${encodeURIComponent(filePath)}/similar`,
        { params: { limit } }
    ).then(res => res.data);

export const getFileTokens = (repoId: string, filePath: string) =>
    client.get<FileTokens>(
        `/repos/${repoId}/semantic/files/${encodeURIComponent(filePath)}/tokens`
    ).then(res => res.data);

export const getBridgeEntities = (repoId: string, minDomains: number = 2) =>
    client.get<BridgeEntity[]>(`/repos/${repoId}/semantic/bridges`, {
        params: { min_domains: minDomains }
    }).then(res => res.data);
