from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import pyarrow.dataset as ds

from lfca.config import RepoPaths


@dataclass(frozen=True)
class ClusterConfig:
    algorithm: str = "components"
    min_weight: float = 0.2
    folders: tuple[str, ...] = ()


class UnionFind:
    def __init__(self, items: Iterable[int]) -> None:
        self.parent = {item: item for item in items}
        self.rank = {item: 0 for item in items}

    def find(self, item: int) -> int:
        parent = self.parent[item]
        if parent != item:
            self.parent[item] = self.find(parent)
        return self.parent[item]

    def union(self, left: int, right: int) -> None:
        left_root = self.find(left)
        right_root = self.find(right)
        if left_root == right_root:
            return
        if self.rank[left_root] < self.rank[right_root]:
            self.parent[left_root] = right_root
        elif self.rank[left_root] > self.rank[right_root]:
            self.parent[right_root] = left_root
        else:
            self.parent[right_root] = left_root
            self.rank[left_root] += 1


def _normalized_folders(folders: Iterable[str]) -> list[str]:
    normalized = []
    for folder in folders:
        trimmed = folder.strip().strip("/")
        if trimmed:
            normalized.append(trimmed)
    return normalized


def _load_file_index(paths: RepoPaths, folders: Iterable[str]) -> dict[int, str]:
    index_path = paths.indexes_dir / "file_index.sqlite"
    if not index_path.exists():
        raise FileNotFoundError("file_index.sqlite not found")
    folders = _normalized_folders(folders)
    with sqlite3.connect(index_path) as conn:
        if not folders:
            rows = conn.execute("SELECT file_id, COALESCE(path_latest, path_current) FROM file_index").fetchall()
        else:
            filters = []
            params: list[str] = []
            for folder in folders:
                filters.append("(path_current = ? OR path_current LIKE ? OR path_latest = ? OR path_latest LIKE ?)")
                params.extend([folder, f"{folder}/%", folder, f"{folder}/%"])
            query = f"SELECT file_id, COALESCE(path_latest, path_current) FROM file_index WHERE {' OR '.join(filters)}"
            rows = conn.execute(query, params).fetchall()
    return {int(file_id): path for file_id, path in rows}


def build_clusters(paths: RepoPaths, config: ClusterConfig) -> dict:
    edges_path = paths.edges_dir / "edges_file_topk.parquet"
    if not edges_path.exists():
        raise FileNotFoundError("edges_file_topk.parquet not found")

    file_index = _load_file_index(paths, config.folders)
    file_ids = sorted(file_index.keys())
    union_find = UnionFind(file_ids)

    dataset = ds.dataset(edges_path)
    columns = ["src_file_id", "dst_file_id", "weight_jaccard"]
    for batch in dataset.to_batches(columns=columns):
        src_ids = batch.column(batch.schema.get_field_index("src_file_id")).to_pylist()
        dst_ids = batch.column(batch.schema.get_field_index("dst_file_id")).to_pylist()
        weights = batch.column(batch.schema.get_field_index("weight_jaccard")).to_pylist()
        for src, dst, weight in zip(src_ids, dst_ids, weights):
            if weight < config.min_weight:
                continue
            src_id = int(src)
            dst_id = int(dst)
            if src_id in union_find.parent and dst_id in union_find.parent:
                union_find.union(src_id, dst_id)

    clusters: dict[int, list[int]] = {}
    for file_id in file_ids:
        root = union_find.find(file_id)
        clusters.setdefault(root, []).append(file_id)

    ranked_clusters = sorted(clusters.values(), key=len, reverse=True)
    results = []
    for idx, cluster in enumerate(ranked_clusters, start=1):
        results.append(
            {
                "id": idx,
                "size": len(cluster),
                "files": [file_index[file_id] for file_id in sorted(cluster)],
            }
        )

    return {
        "algorithm": config.algorithm,
        "min_weight": config.min_weight,
        "folders": list(config.folders),
        "cluster_count": len(results),
        "clusters": results,
    }


def save_clusters(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))
