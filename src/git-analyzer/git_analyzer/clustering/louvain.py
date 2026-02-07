"""Louvain community detection."""

from git_analyzer.clustering.base import ClusterAlgorithm, ClusterResult
from git_analyzer.clustering.registry import register


@register
class Louvain(ClusterAlgorithm):
    name = "louvain"
    
    @classmethod
    def get_params_schema(cls) -> dict:
        return {
            "type": "object",
            "properties": {
                "resolution": {
                    "type": "number",
                    "default": 1.0,
                    "description": "Resolution parameter (higher = smaller communities)"
                },
                "min_weight": {
                    "type": "number",
                    "default": 0.0,
                    "description": "Minimum edge weight"
                },
                "random_state": {
                    "type": "integer",
                    "description": "Random seed for reproducibility"
                }
            }
        }
    
    def run(self, edges, file_ids, file_paths, params) -> ClusterResult:
        try:
            import networkx as nx
            from community import community_louvain
        except ImportError:
            raise ImportError("Install python-louvain: pip install python-louvain networkx")
        
        resolution = params.get("resolution", 1.0)
        min_weight = params.get("min_weight", 0.0)
        weight_col = params.get("weight_column", "jaccard")
        random_state = params.get("random_state")
        
        # Build graph
        G = nx.Graph()
        G.add_nodes_from(file_ids)
        
        for edge in edges:
            weight = edge.get(weight_col, edge.get("jaccard", 0))
            if weight >= min_weight:
                G.add_edge(
                    edge["src_file_id"],
                    edge["dst_file_id"],
                    weight=weight
                )
        
        # Run Louvain
        partition = community_louvain.best_partition(
            G,
            weight="weight",
            resolution=resolution,
            random_state=random_state
        )
        
        # Calculate modularity (undefined for graphs with no edges)
        if G.number_of_edges() > 0:
            modularity = community_louvain.modularity(partition, G, weight="weight")
        else:
            modularity = 0.0
        
        # Group by community
        communities: dict[int, list[int]] = {}
        for node, comm_id in partition.items():
            communities.setdefault(comm_id, []).append(node)
        
        sorted_comms = sorted(communities.values(), key=len, reverse=True)
        
        clusters = [
            {
                "id": i + 1,
                "size": len(c),
                "file_ids": c,
                "files": [file_paths.get(fid, f"file:{fid}") for fid in c]
            }
            for i, c in enumerate(sorted_comms)
        ]
        
        return ClusterResult(
            algorithm="louvain",
            parameters={"resolution": resolution, "min_weight": min_weight},
            cluster_count=len(clusters),
            clusters=clusters,
            metrics={"modularity": modularity}
        )
