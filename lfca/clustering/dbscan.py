"""DBSCAN clustering."""

from lfca.clustering.base import ClusterAlgorithm, ClusterResult
from lfca.clustering.registry import register


@register
class DBSCAN(ClusterAlgorithm):
    name = "dbscan"
    
    @classmethod
    def get_params_schema(cls) -> dict:
        return {
            "type": "object",
            "properties": {
                "eps": {
                    "type": "number",
                    "default": 0.5,
                    "description": "Maximum distance between samples (1 - similarity)"
                },
                "min_samples": {
                    "type": "integer",
                    "default": 2,
                    "description": "Minimum samples in neighborhood"
                }
            }
        }
    
    def run(self, edges, file_ids, file_paths, params) -> ClusterResult:
        try:
            import numpy as np
            from sklearn.cluster import DBSCAN as SklearnDBSCAN
        except ImportError:
            raise ImportError("Install scikit-learn: pip install scikit-learn numpy")
        
        eps = params.get("eps", 0.5)
        min_samples = params.get("min_samples", 2)
        weight_col = params.get("weight_column", "jaccard")
        
        # Build distance matrix
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
        
        # Run DBSCAN
        clustering = SklearnDBSCAN(eps=eps, min_samples=min_samples, metric='precomputed')
        labels = clustering.fit_predict(dist_matrix)
        
        # Group by label (-1 is noise)
        clusters_map: dict[int, list[int]] = {}
        noise_files = []
        
        for idx, label in enumerate(labels):
            fid = file_list[idx]
            if label == -1:
                noise_files.append(fid)
            else:
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
            algorithm="dbscan",
            parameters={"eps": eps, "min_samples": min_samples},
            cluster_count=len(clusters),
            clusters=clusters,
            metrics={
                "noise_count": len(noise_files),
                "noise_files": [file_paths.get(fid) for fid in noise_files[:20]]
            }
        )
