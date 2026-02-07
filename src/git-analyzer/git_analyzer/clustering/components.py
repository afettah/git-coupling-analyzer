"""Connected components clustering."""

from git_analyzer.clustering.base import ClusterAlgorithm, ClusterResult
from git_analyzer.clustering.registry import register


class UnionFind:
    def __init__(self, items):
        self.parent = {item: item for item in items}
        self.rank = {item: 0 for item in items}
    
    def find(self, item):
        if self.parent[item] != item:
            self.parent[item] = self.find(self.parent[item])
        return self.parent[item]
    
    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return
        if self.rank[ra] < self.rank[rb]:
            self.parent[ra] = rb
        elif self.rank[ra] > self.rank[rb]:
            self.parent[rb] = ra
        else:
            self.parent[rb] = ra
            self.rank[ra] += 1


@register
class ConnectedComponents(ClusterAlgorithm):
    name = "components"
    
    @classmethod
    def get_params_schema(cls) -> dict:
        return {
            "type": "object",
            "properties": {
                "min_weight": {
                    "type": "number",
                    "default": 0.1,
                    "description": "Minimum edge weight to include"
                }
            }
        }
    
    def run(self, edges, file_ids, file_paths, params) -> ClusterResult:
        min_weight = params.get("min_weight", 0.1)
        weight_col = params.get("weight_column", "jaccard")
        
        uf = UnionFind(file_ids)
        
        for edge in edges:
            weight = edge.get(weight_col, edge.get("jaccard", 0))
            if weight >= min_weight:
                src = edge["src_file_id"]
                dst = edge["dst_file_id"]
                if src in uf.parent and dst in uf.parent:
                    uf.union(src, dst)
        
        # Group by root
        clusters_map: dict[int, list[int]] = {}
        for fid in file_ids:
            root = uf.find(fid)
            clusters_map.setdefault(root, []).append(fid)
        
        # Sort by size
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
            algorithm="components",
            parameters={"min_weight": min_weight},
            cluster_count=len(clusters),
            clusters=clusters
        )
