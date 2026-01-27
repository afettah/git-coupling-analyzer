"""Hierarchical agglomerative clustering."""

from lfca.clustering.base import ClusterAlgorithm, ClusterResult
from lfca.clustering.registry import register


@register
class Hierarchical(ClusterAlgorithm):
    name = "hierarchical"
    
    @classmethod
    def get_params_schema(cls) -> dict:
        return {
            "type": "object",
            "properties": {
                "n_clusters": {
                    "type": "integer",
                    "description": "Number of clusters (required if distance_threshold not set)"
                },
                "distance_threshold": {
                    "type": "number",
                    "description": "Distance threshold for cutting dendrogram"
                },
                "linkage": {
                    "type": "string",
                    "enum": ["ward", "complete", "average", "single"],
                    "default": "average"
                }
            }
        }
    
    def run(self, edges, file_ids, file_paths, params) -> ClusterResult:
        try:
            import numpy as np
            from scipy.cluster.hierarchy import linkage, fcluster
            from scipy.spatial.distance import squareform
        except ImportError:
            raise ImportError("Install scipy: pip install scipy numpy")
        
        n_clusters = params.get("n_clusters")
        distance_threshold = params.get("distance_threshold")
        linkage_method = params.get("linkage", "average")
        weight_col = params.get("weight_column", "jaccard")
        
        if n_clusters is None and distance_threshold is None:
            n_clusters = 10  # Default
        
        # Build distance matrix (1 - similarity)
        file_list = sorted(file_ids)
        n = len(file_list)
        id_to_idx = {fid: i for i, fid in enumerate(file_list)}
        
        dist_matrix = np.ones((n, n))
        np.fill_diagonal(dist_matrix, 0)
        
        for edge in edges:
            src_idx = id_to_idx.get(edge["src_file_id"])
            dst_idx = id_to_idx.get(edge["dst_file_id"])
            if src_idx is not None and dst_idx is not None:
                weight = edge.get(weight_col, edge.get("jaccard", 0))
                distance = 1 - weight
                dist_matrix[src_idx, dst_idx] = distance
                dist_matrix[dst_idx, src_idx] = distance
        
        # Perform hierarchical clustering
        condensed = squareform(dist_matrix)
        Z = linkage(condensed, method=linkage_method)
        
        if distance_threshold:
            labels = fcluster(Z, t=distance_threshold, criterion='distance')
        else:
            labels = fcluster(Z, t=n_clusters, criterion='maxclust')
        
        # Group by label
        clusters_map: dict[int, list[int]] = {}
        for idx, label in enumerate(labels):
            fid = file_list[idx]
            clusters_map.setdefault(int(label), []).append(fid)
        
        sorted_clusters = sorted(clusters_map.values(), key=len, reverse=True)
        
        clusters = [
            {
                "id": i + 1,
                "size": len(c),
                "file_ids": c,
                "files": [file_paths.get(fid, f"file:{fid}") for fid in c]
            }
            for i, c in enumerate(sorted_clusters)
        ]
        
        return ClusterResult(
            algorithm="hierarchical",
            parameters={"n_clusters": n_clusters, "linkage": linkage_method},
            cluster_count=len(clusters),
            clusters=clusters
        )
