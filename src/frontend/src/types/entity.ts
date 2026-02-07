// Core entity and relationship types for the unified knowledge graph

export interface Entity {
    entity_id: number;
    qualified_name: string;
    name: string;
    kind: EntityKind;
    language?: string;
    parent_id?: number;
    metadata: Record<string, any>;
    created_at?: string;
    updated_at?: string;
}

export type EntityKind =
    | 'file'
    | 'class'
    | 'function'
    | 'package'
    | 'module'
    | 'external_package';

export interface Relationship {
    rel_id: number;
    source_type: SourceType;
    rel_kind: RelationshipKind;
    src_entity_id: number;
    dst_entity_id: number;
    weight: number;
    metadata: Record<string, any>;
    run_id?: string;
    created_at?: string;
}

export type SourceType = 'git' | 'deps' | 'semantic' | 'intelligence';

export type RelationshipKind =
    // Git relationships
    | 'CO_CHANGED'
    | 'RENAMED_TO'
    | 'MOVED_TO'
    // Dependency relationships
    | 'IMPORTS'
    | 'DEPENDS_ON'
    | 'USES'
    | 'CONTAINS'
    | 'OWNS'
    // Semantic relationships
    | 'SIMILAR_TO'
    | 'BELONGS_TO_DOMAIN'
    // Intelligence relationships
    | 'ARCHITECTURALLY_COUPLED';

export interface Domain {
    domain_id: number;
    name: string;
    label?: string;
    description?: string;
    coherence_score: number;
    member_count: number;
    top_terms: string[];
    created_at?: string;
    updated_at?: string;
}

export interface DomainMember {
    domain_id: number;
    entity_id: number;
    score: number;
}

// Helper type for entities with relationships
export interface EntityWithRelationships extends Entity {
    relationships: {
        outgoing: Array<Relationship & { dst_entity: Entity }>;
        incoming: Array<Relationship & { src_entity: Entity }>;
    };
}

// Constants for relationship kinds
export const RelKind = {
    // Git
    CO_CHANGED: 'CO_CHANGED',
    RENAMED_TO: 'RENAMED_TO',
    MOVED_TO: 'MOVED_TO',
    // Dependencies
    IMPORTS: 'IMPORTS',
    DEPENDS_ON: 'DEPENDS_ON',
    USES: 'USES',
    CONTAINS: 'CONTAINS',
    OWNS: 'OWNS',
    // Semantic
    SIMILAR_TO: 'SIMILAR_TO',
    BELONGS_TO_DOMAIN: 'BELONGS_TO_DOMAIN',
    // Intelligence
    ARCHITECTURALLY_COUPLED: 'ARCHITECTURALLY_COUPLED',
} as const;

// Constants for entity kinds
export const EntityKindConst = {
    FILE: 'file',
    CLASS: 'class',
    FUNCTION: 'function',
    PACKAGE: 'package',
    MODULE: 'module',
    EXTERNAL_PACKAGE: 'external_package',
} as const;
