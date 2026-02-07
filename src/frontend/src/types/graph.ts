// Graph query and visualization types

import type { Entity, Relationship } from './entity';

export interface GraphNode {
    id: number;
    entity: Entity;
    degree: number;
    domain?: string;
    risk_score?: number;
    x?: number;
    y?: number;
}

export interface GraphEdge {
    source: number;
    target: number;
    source_type: 'git' | 'deps' | 'semantic' | 'intelligence';
    rel_kind: string;
    weight: number;
    metadata?: Record<string, any>;
}

export interface NeighborGraph {
    center: Entity;
    nodes: GraphNode[];
    edges: GraphEdge[];
    depth: number;
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
    connected_components: number;
}

export interface GraphFilters {
    sourceTypes: Set<string>;
    minWeight: number;
    maxWeight: number;
    entityKinds: Set<string>;
    showExternal: boolean;
}

// D3 simulation node type
export interface D3Node extends GraphNode {
    x: number;
    y: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
}

// D3 simulation link type
export interface D3Link extends Omit<GraphEdge, 'source' | 'target'> {
    source: D3Node | number | string;
    target: D3Node | number | string;
}

// Helper to get edge color by source type
export const getEdgeColorBySource = (sourceType: string): string => {
    switch (sourceType) {
        case 'git':
            return '#3b82f6'; // blue
        case 'deps':
            return '#10b981'; // green
        case 'semantic':
            return '#8b5cf6'; // purple
        case 'intelligence':
            return '#f59e0b'; // amber
        default:
            return '#6b7280'; // gray
    }
};

// Helper to get edge width by weight
export const getEdgeWidth = (weight: number, minWeight: number = 0, maxWeight: number = 1): number => {
    const normalized = (weight - minWeight) / (maxWeight - minWeight);
    return 1 + normalized * 4; // 1-5px
};

// Helper to get node size by degree
export const getNodeSize = (degree: number, maxDegree: number = 1): number => {
    const normalized = Math.min(degree / maxDegree, 1);
    return 4 + normalized * 12; // 4-16px radius
};
