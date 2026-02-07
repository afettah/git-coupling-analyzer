"""Label propagation clustering."""

from git_analyzer.clustering.base import ClusterAlgorithm, ClusterResult
from git_analyzer.clustering.registry import register


@register
class LabelPropagation(ClusterAlgorithm):
    name = "label_propagation"
    
    @classmethod
    def get_params_schema(cls) -> dict:
        return {
            "type": "object",
            "properties": {
                "min_weight": {
                    "type": "number",
                    "default": 0.0
                },
                "max_iterations": {
                    "type": "integer",
                    "default": 100
                }
            }
        }
    
    def run(self, edges, file_ids, file_paths, params) -> ClusterResult:
        try:
            import networkx as nx
        except ImportError:
            raise ImportError("Install networkx: pip install networkx")
        
        min_weight = params.get("min_weight", 0.0)
        weight_col = params.get("weight_column", "jaccard")
        
        G = nx.Graph()
        G.add_nodes_from(file_ids)
        
        for edge in edges:
            weight = edge.get(weight_col, edge.get("jaccard", 0))
            if weight >= min_weight:
                G.add_edge(edge["src_file_id"], edge["dst_file_id"], weight=weight)
        
        communities = list(nx.community.label_propagation_communities(G))
        
        clusters = [
            {
                "id": i + 1,
                "size": len(c),
                "file_ids": list(c),
                "files": [file_paths.get(fid, f"file:{fid}") for fid in c]
            }
            for i, c in enumerate(sorted(communities, key=len, reverse=True))
        ]
        
        return ClusterResult(
            algorithm="label_propagation",
            parameters={"min_weight": min_weight},
            cluster_count=len(clusters),
            clusters=clusters
        )
