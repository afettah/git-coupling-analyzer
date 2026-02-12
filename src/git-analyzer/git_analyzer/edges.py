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
    def __init__(self, paths: RepoPaths, config: CouplingConfig, storage: Storage | None = None):
        self.paths = paths
        self.config = config
        self._owns_storage = storage is None
        self.storage = storage or Storage(paths.db_path, paths.parquet_dir)
    
    def build(self) -> int:
        """Build coupling edges from transactions."""
        
        # Load commits and changes from Parquet
        commits = self.storage.read_parquet("commits").to_pylist()
        changes = self.storage.read_parquet("changes").to_pylist()
        
        logger.info(f"Building edges from {len(commits)} commits...")
        
        # Get changesets based on grouping mode
        changesets = list(get_changesets(commits, changes, self.config))
        
        # Count pairs and file occurrences
        pair_counts_weighted: dict[tuple[int, int], float] = defaultdict(float)
        pair_counts_raw: Counter[tuple[int, int]] = Counter()
        file_counts: Counter[int] = Counter()
        file_weights: dict[int, float] = defaultdict(float)

        latest_changeset_ts = max((cs.timestamp for cs in changesets), default=0)
        decay_half_life = self.config.decay_half_life_days
        
        for cs in changesets:
            file_ids = sorted(cs.file_ids)
            
            # Skip if too few files
            if len(file_ids) < 2:
                continue
            
            # Calculate weight
            weight = cs.weight
            if decay_half_life and decay_half_life > 0 and latest_changeset_ts and cs.timestamp:
                age_days = max(0.0, (latest_changeset_ts - cs.timestamp) / 86400.0)
                weight *= math.pow(0.5, age_days / decay_half_life)
            
            # Count pairs
            for a, b in combinations(file_ids, 2):
                key = (a, b)
                pair_counts_weighted[key] += weight
                pair_counts_raw[key] += 1
            
            for fid in file_ids:
                file_counts[fid] += 1
                file_weights[fid] += weight
        
        logger.info(f"Counted {len(pair_counts_weighted)} file pairs")
        
        # Filter by min_revisions and min_cooccurrence
        min_revisions = max(1, self.config.min_revisions)
        eligible_files = {fid for fid, count in file_counts.items() if count >= min_revisions}
        min_cooc = self.config.min_cooccurrence
        filtered_pairs: dict[tuple[int, int], tuple[float, int]] = {}
        for pair, weighted_count in pair_counts_weighted.items():
            raw_count = pair_counts_raw[pair]
            if raw_count < min_cooc:
                continue
            if pair[0] not in eligible_files or pair[1] not in eligible_files:
                continue
            filtered_pairs[pair] = (weighted_count, raw_count)
        
        logger.info(f"After filtering: {len(filtered_pairs)} pairs")
        
        # Build edges with metrics
        edges = []
        for (src, dst), (pair_count_weighted, pair_count_raw) in filtered_pairs.items():
            src_count = file_counts[src]
            dst_count = file_counts[dst]
            src_weight = file_weights[src]
            dst_weight = file_weights[dst]
            
            # Jaccard and conditional probabilities are computed on raw counts.
            denom = src_count + dst_count - pair_count_raw
            jaccard = pair_count_raw / denom if denom > 0 else 0
            
            # Weighted Jaccard
            denom_w = src_weight + dst_weight - pair_count_weighted
            jaccard_weighted = pair_count_weighted / denom_w if denom_w > 0 else 0
            
            # Conditional probabilities
            p_dst_given_src = pair_count_raw / src_count if src_count > 0 else 0
            p_src_given_dst = pair_count_raw / dst_count if dst_count > 0 else 0
            
            edges.append({
                "src_entity_id": src,
                "dst_entity_id": dst,
                "pair_count": pair_count_weighted,
                "src_count": src_count,
                "dst_count": dst_count,
                "src_weight": src_weight,
                "dst_weight": dst_weight,
                "jaccard": jaccard,
                "jaccard_weighted": jaccard_weighted,
                "p_dst_given_src": p_dst_given_src,
                "p_src_given_dst": p_src_given_dst,
                "pair_count_raw": pair_count_raw,
            })
        
        # Apply top-K per file
        if self.config.topk_edges_per_file is not None and self.config.topk_edges_per_file > 0:
            edges = self._apply_topk(edges)
        
        # Prepare unified relationships and git_edges
        import json
        unified_rels = []
        for e in edges:
            unified_rels.append({
                "source_type": "git",
                "rel_kind": "CO_CHANGED",
                "src_entity_id": e["src_entity_id"],
                "dst_entity_id": e["dst_entity_id"],
                "weight": e["jaccard"],
                "properties_json": json.dumps({
                    "pair_count": e["pair_count"],
                    "pair_count_raw": e["pair_count_raw"],
                    "src_count": e["src_count"],
                    "dst_count": e["dst_count"],
                    "jaccard_weighted": e["jaccard_weighted"],
                    "p_dst_given_src": e["p_dst_given_src"],
                    "p_src_given_dst": e["p_src_given_dst"]
                }),
                "run_id": None
            })
            
        # Store in unified relationships table
        self.storage.upsert_relationships(unified_rels)
        
        # Also store in git_edges table with full metrics
        self._store_git_edges(edges)
        
        # Build component-level edges
        self._build_component_edges(edges)
        
        logger.info(f"Stored {len(edges)} edges")
        return len(edges)
    
    def _apply_topk(self, edges: list[dict]) -> list[dict]:
        """Keep top-K edges per file."""
        k = self.config.topk_edges_per_file
        if k is None or k <= 0:
            return edges
        k = int(k)
        
        # Group by source and dest
        by_file: dict[int, list[dict]] = defaultdict(list)
        for e in edges:
            by_file[e["src_entity_id"]].append(e)
            by_file[e["dst_entity_id"]].append(e)
        
        # Keep top-K per file
        kept = set()
        for file_id, file_edges in by_file.items():
            sorted_edges = sorted(file_edges, key=lambda x: x["jaccard"], reverse=True)
            for e in sorted_edges[:k]:
                kept.add((e["src_entity_id"], e["dst_entity_id"]))
        
        return [e for e in edges if (e["src_entity_id"], e["dst_entity_id"]) in kept]
    
    def _build_component_edges(self, edges: list[dict]):
        """Aggregate edges at component/folder level."""
        depth = self.config.component_depth
        
        # Get file paths
        file_ids = set()
        for e in edges:
            file_ids.add(e["src_entity_id"])
            file_ids.add(e["dst_entity_id"])
        
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
        
        min_component_cooccurrence = max(1, self.config.min_component_cooccurrence)
        for e in edges:
            src_comp = file_to_comp.get(e["src_entity_id"])
            dst_comp = file_to_comp.get(e["dst_entity_id"])
            
            if src_comp and dst_comp and src_comp != dst_comp:
                key = tuple(sorted([src_comp, dst_comp]))
                comp_edges[key]["pair_count"] += e["pair_count"]
                comp_edges[key]["jaccard_sum"] += e["jaccard"]
                comp_edges[key]["file_pairs"] += 1
        
        # Store
        for (src, dst), data in comp_edges.items():
            if data["pair_count"] < min_component_cooccurrence:
                continue
            avg_jaccard = data["jaccard_sum"] / data["file_pairs"] if data["file_pairs"] else 0
            self.storage.conn.execute("""
                INSERT OR REPLACE INTO git_component_edges
                (src_component, dst_component, depth, pair_count, jaccard, file_pair_count)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (src, dst, depth, data["pair_count"], avg_jaccard, data["file_pairs"]))
        
        self.storage.conn.commit()
    
    def _store_git_edges(self, edges: list[dict]):
        """Store edges in git_edges table with full metrics."""
        self.storage.conn.executemany("""
            INSERT OR REPLACE INTO git_edges (
                src_entity_id, dst_entity_id, pair_count,
                src_count, dst_count, src_weight, dst_weight,
                jaccard, jaccard_weighted, p_dst_given_src, p_src_given_dst
            ) VALUES (
                :src_entity_id, :dst_entity_id, :pair_count,
                :src_count, :dst_count, :src_weight, :dst_weight,
                :jaccard, :jaccard_weighted, :p_dst_given_src, :p_src_given_dst
            )
        """, edges)
        self.storage.conn.commit()
    
    def close(self):
        if self._owns_storage:
            self.storage.close()
