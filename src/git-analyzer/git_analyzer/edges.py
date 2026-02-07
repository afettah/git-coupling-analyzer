"""Edge building with proper metrics."""

from __future__ import annotations

import math
from collections import Counter, defaultdict
from itertools import combinations

from code_intel.config import RepoPaths
from git_analyzer.config import CouplingConfig
from code_intel.storage import Storage
from git_analyzer.changesets import get_changesets
from code_intel.logging_utils import get_logger

logger = get_logger(__name__)


class EdgeBuilder:
    def __init__(self, paths: RepoPaths, config: CouplingConfig):
        self.paths = paths
        self.config = config
        self.storage = Storage(paths.db_path, paths.parquet_dir)
    
    def build(self) -> int:
        """Build coupling edges from transactions."""
        
        # Load commits and changes from Parquet
        commits = self.storage.read_parquet("commits").to_pylist()
        changes = self.storage.read_parquet("changes").to_pylist()
        
        logger.info(f"Building edges from {len(commits)} commits...")
        
        # Get changesets based on grouping mode
        changesets = list(get_changesets(commits, changes, self.config))
        
        # Count pairs and file occurrences
        pair_counts: dict[tuple[int, int], float] = defaultdict(float)
        file_counts: Counter[int] = Counter()
        file_weights: dict[int, float] = defaultdict(float)
        
        for cs in changesets:
            file_ids = sorted(cs.file_ids)
            
            # Skip if too few files
            if len(file_ids) < 2:
                continue
            
            # Calculate weight
            weight = cs.weight
            if len(file_ids) > self.config.max_changeset_size:
                weight *= 1.0 / math.log(1.0 + len(file_ids))
            
            # Count pairs
            for a, b in combinations(file_ids, 2):
                pair_counts[(a, b)] += weight
            
            for fid in file_ids:
                file_counts[fid] += 1
                file_weights[fid] += weight
        
        logger.info(f"Counted {len(pair_counts)} file pairs")
        
        # Filter by min_cooccurrence
        min_cooc = self.config.min_cooccurrence
        filtered_pairs = {
            k: v for k, v in pair_counts.items()
            if v >= min_cooc
        }
        
        logger.info(f"After filtering: {len(filtered_pairs)} pairs")
        
        # Build edges with metrics
        edges = []
        for (src, dst), pair_count in filtered_pairs.items():
            src_count = file_counts[src]
            dst_count = file_counts[dst]
            src_weight = file_weights[src]
            dst_weight = file_weights[dst]
            
            # Jaccard (unweighted)
            denom = src_count + dst_count - pair_count
            jaccard = pair_count / denom if denom > 0 else 0
            
            # Weighted Jaccard
            denom_w = src_weight + dst_weight - pair_count
            jaccard_weighted = pair_count / denom_w if denom_w > 0 else 0
            
            # Conditional probabilities
            p_dst_given_src = pair_count / src_count if src_count > 0 else 0
            p_src_given_dst = pair_count / dst_count if dst_count > 0 else 0
            
            edges.append({
                "src_file_id": src,
                "dst_file_id": dst,
                "pair_count": pair_count,
                "src_count": src_count,
                "dst_count": dst_count,
                "src_weight": src_weight,
                "dst_weight": dst_weight,
                "jaccard": jaccard,
                "jaccard_weighted": jaccard_weighted,
                "p_dst_given_src": p_dst_given_src,
                "p_src_given_dst": p_src_given_dst
            })
        
        # Apply top-K per file
        if self.config.topk_edges_per_file:
            edges = self._apply_topk(edges)
        
        # Prepare unified relationships
        unified_rels = []
        for e in edges:
            unified_rels.append({
                "source_type": "git",
                "rel_kind": "CO_CHANGED",
                "src_entity_id": e["src_file_id"],
                "dst_entity_id": e["dst_file_id"],
                "weight": e["jaccard"],
                "properties": {
                    "pair_count": e["pair_count"],
                    "src_count": e["src_count"],
                    "dst_count": e["dst_count"],
                    "jaccard_weighted": e["jaccard_weighted"],
                    "p_dst_given_src": e["p_dst_given_src"],
                    "p_src_given_dst": e["p_src_given_dst"]
                }
            })
            
        # Store in SQLite
        self.storage.upsert_relationships(unified_rels)
        
        # Build component-level edges
        self._build_component_edges(edges)
        
        logger.info(f"Stored {len(edges)} edges")
        return len(edges)
    
    def _apply_topk(self, edges: list[dict]) -> list[dict]:
        """Keep top-K edges per file."""
        k = self.config.topk_edges_per_file
        
        # Group by source and dest
        by_file: dict[int, list[dict]] = defaultdict(list)
        for e in edges:
            by_file[e["src_file_id"]].append(e)
            by_file[e["dst_file_id"]].append(e)
        
        # Keep top-K per file
        kept = set()
        for file_id, file_edges in by_file.items():
            sorted_edges = sorted(file_edges, key=lambda x: x["jaccard"], reverse=True)
            for e in sorted_edges[:k]:
                kept.add((e["src_file_id"], e["dst_file_id"]))
        
        return [e for e in edges if (e["src_file_id"], e["dst_file_id"]) in kept]
    
    def _build_component_edges(self, edges: list[dict]):
        """Aggregate edges at component/folder level."""
        depth = self.config.component_depth
        
        # Get file paths
        file_ids = set()
        for e in edges:
            file_ids.add(e["src_file_id"])
            file_ids.add(e["dst_file_id"])
        
        if not file_ids:
            return
        
        placeholders = ",".join("?" * len(file_ids))
        rows = self.storage.conn.execute(f"""
            SELECT entity_id, qualified_name FROM entities WHERE entity_id IN ({placeholders})
        """, list(file_ids)).fetchall()
        
        file_to_path = {r[0]: r[1] for r in rows if r[1]}
        
        def get_component(path: str) -> str:
            parts = path.split("/")
            return "/".join(parts[:depth]) if len(parts) > depth else path
        
        file_to_comp = {fid: get_component(p) for fid, p in file_to_path.items()}
        
        # Aggregate
        comp_edges: dict[tuple[str, str], dict] = defaultdict(
            lambda: {"pair_count": 0.0, "jaccard_sum": 0.0, "file_pairs": 0}
        )
        
        for e in edges:
            src_comp = file_to_comp.get(e["src_file_id"])
            dst_comp = file_to_comp.get(e["dst_file_id"])
            
            if src_comp and dst_comp and src_comp != dst_comp:
                key = tuple(sorted([src_comp, dst_comp]))
                comp_edges[key]["pair_count"] += e["pair_count"]
                comp_edges[key]["jaccard_sum"] += e["jaccard"]
                comp_edges[key]["file_pairs"] += 1
        
        # Store
        for (src, dst), data in comp_edges.items():
            avg_jaccard = data["jaccard_sum"] / data["file_pairs"] if data["file_pairs"] else 0
            self.storage.conn.execute("""
                INSERT OR REPLACE INTO component_edges
                (src_component, dst_component, depth, pair_count, jaccard, file_pair_count)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (src, dst, depth, data["pair_count"], avg_jaccard, data["file_pairs"]))
        
        self.storage.conn.commit()
    
    def close(self):
        self.storage.close()
