import { client } from './client';

// === Types ===

export interface Entity {
    entity_id: number;
    qualified_name: string;
    name: string;
    kind: string; // 'file' | 'class' | 'function' | 'package' | 'external_package'
    language?: string;
    parent_id?: number;
    metadata: Record<string, any>;
}

export interface Relationship {
    rel_id: number;
    source_type: string; // 'git' | 'deps' | 'semantic' | 'intelligence'
    rel_kind: string;
    src_entity_id: number;
    dst_entity_id: number;
    weight: number;
    metadata: Record<string, any>;
    run_id?: string;
}

export interface EntityDetail extends Entity {
    relationships: {
        outgoing: Array<Relationship & { dst_entity: Entity }>;
        incoming: Array<Relationship & { src_entity: Entity }>;
    };
    risk_score?: number;
    domains?: Array<{
        domain_id: number;
        domain_name: string;
        score: number;
    }>;
}

export interface GraphNode {
    id: number;
    entity: Entity;
    degree: number;
    domain?: string;
}

export interface GraphEdge {
    source: number;
    target: number;
    source_type: string;
    rel_kind: string;
    weight: number;
}

export interface NeighborGraph {
    center: Entity;
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export interface PathResult {
    path: Entity[];
    edges: Relationship[];
    length: number;
    total_weight: number;
}

export interface GraphStats {
    total_entities: number;
    total_relationships: number;
    by_source: Record<string, number>;
    by_kind: Record<string, number>;
    avg_degree: number;
    max_degree: number;
    density: number;
}

// === API Functions ===

export const searchEntities = (repoId: string, query: {
    q?: string;
    kind?: string;
    language?: string;
    limit?: number;
    offset?: number;
}) =>
    client.get<Entity[]>(`/repos/${repoId}/graph/entities`, { params: query }).then(res => res.data);

export const getEntity = (repoId: string, entityId: number) =>
    client.get<EntityDetail>(`/repos/${repoId}/graph/entities/${entityId}`).then(res => res.data);

export const getRelationships = (repoId: string, filters?: {
    source_type?: string;
    rel_kind?: string;
    min_weight?: number;
    limit?: number;
}) =>
    client.get<Relationship[]>(`/repos/${repoId}/graph/relationships`, { params: filters }).then(res => res.data);

export const getNeighbors = (repoId: string, entityId: number, options?: {
    max_depth?: number;
    source_types?: string[];
    min_weight?: number;
}) =>
    client.get<NeighborGraph>(`/repos/${repoId}/graph/neighbors/${entityId}`, { params: options }).then(res => res.data);

export const findPath = (repoId: string, fromId: number, toId: number, options?: {
    max_length?: number;
    source_types?: string[];
}) =>
    client.get<PathResult>(`/repos/${repoId}/graph/path`, {
        params: { from: fromId, to: toId, ...options }
    }).then(res => res.data);

export const getGraphStats = (repoId: string) =>
    client.get<GraphStats>(`/repos/${repoId}/graph/stats`).then(res => res.data);
