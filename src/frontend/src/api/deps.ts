import { client } from './client';

// === Types ===

export interface ImportInfo {
    import_id: number;
    src_entity_id: number;
    dst_entity_id: number;
    src_path: string;
    dst_path: string;
    import_type: 'static' | 'dynamic';
    is_external: boolean;
    is_dynamic: boolean;
}

export interface CircularDep {
    cycle_id: number;
    cycle_path: string[];
    cycle_length: number;
}

export interface ExternalPackage {
    name: string;
    usage_count: number;
    importing_files: number;
}

export interface ImportGraphNode {
    id: number;
    path: string;
    name: string;
    kind: string;
    language?: string;
    is_external: boolean;
}

export interface ImportGraphEdge {
    source: number;
    target: number;
    import_type: string;
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
        import_type: string;
        is_external: boolean;
    }>;
    imported_by: Array<{
        path: string;
        import_type: string;
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
}

// === API Functions ===

export const getImportGraph = (repoId: string, filters?: {
    language?: string;
    includeExternal?: boolean;
    minImports?: number;
}) =>
    client.get<ImportGraph>(`/repos/${repoId}/deps/graph`, { params: filters }).then(res => res.data);

export const getFileImports = (repoId: string, filePath: string) =>
    client.get<FileImports>(`/repos/${repoId}/deps/files/${encodeURIComponent(filePath)}/imports`).then(res => res.data);

export const getCircularDeps = (repoId: string) =>
    client.get<CircularDep[]>(`/repos/${repoId}/deps/circular`).then(res => res.data);

export const getExternalPackages = (repoId: string) =>
    client.get<ExternalPackage[]>(`/repos/${repoId}/deps/external`).then(res => res.data);

export const getDepsStats = (repoId: string) =>
    client.get<DepsStats>(`/repos/${repoId}/deps/stats`).then(res => res.data);
