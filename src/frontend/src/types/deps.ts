// Dependency analysis types

export interface ImportInfo {
    import_id: number;
    src_entity_id: number;
    dst_entity_id: number;
    src_path: string;
    dst_path: string;
    import_type: ImportType;
    is_external: boolean;
    is_dynamic: boolean;
}

export type ImportType = 'static' | 'dynamic';

export interface CircularDep {
    cycle_id: number;
    cycle_path: string[];
    cycle_length: number;
    severity?: 'low' | 'medium' | 'high';
}

export interface ExternalPackage {
    name: string;
    usage_count: number;
    importing_files: number;
    package_type?: 'npm' | 'pypi' | 'maven' | 'nuget' | 'other';
}

export interface ImportGraphNode {
    id: number;
    path: string;
    name: string;
    kind: string;
    language?: string;
    is_external: boolean;
    import_count?: number;
    imported_by_count?: number;
}

export interface ImportGraphEdge {
    source: number;
    target: number;
    import_type: ImportType;
    is_dynamic: boolean;
}

export interface ImportGraph {
    nodes: ImportGraphNode[];
    edges: ImportGraphEdge[];
}

export interface FileImports {
    file_path: string;
    imports: Array<{
        path: string;
        import_type: ImportType;
        is_external: boolean;
        line_number?: number;
    }>;
    imported_by: Array<{
        path: string;
        import_type: ImportType;
        line_number?: number;
    }>;
}

export interface DepsStats {
    total_imports: number;
    total_files: number;
    external_packages: number;
    circular_dependencies: number;
    avg_imports_per_file: number;
    max_fan_out: number;
    max_fan_in: number;
    languages: Record<string, number>;
}

// Helper to determine cycle severity
export const getCycleSeverity = (length: number): 'low' | 'medium' | 'high' => {
    if (length <= 2) return 'low';
    if (length <= 4) return 'medium';
    return 'high';
};

// Helper to get severity color
export const getSeverityColor = (severity: 'low' | 'medium' | 'high'): string => {
    switch (severity) {
        case 'low':
            return 'yellow';
        case 'medium':
            return 'orange';
        case 'high':
            return 'red';
        default:
            return 'gray';
    }
};
