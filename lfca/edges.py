from __future__ import annotations

import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from itertools import combinations
from pathlib import Path
from typing import Iterable

import pyarrow as pa

from lfca.config import RepoPaths
from lfca.storage import ParquetSink


@dataclass
class EdgeConfig:
    max_files_per_commit: int = 300
    bulk_policy: str = "downweight"  # or exclude
    topk_edges_per_file: int = 50


def _commit_weight(tx_size: int, policy: str) -> float:
    if policy == "exclude":
        return 0.0
    return 1.0 / math.log(1.0 + tx_size)


class EdgeBuilder:
    def __init__(self, paths: RepoPaths, config: EdgeConfig | None = None) -> None:
        self.paths = paths
        self.config = config or EdgeConfig()

    def build(self, transactions: Iterable[list[int]]) -> None:
        pair_counts: dict[tuple[int, int], float] = defaultdict(float)
        file_counts: Counter[int] = Counter()
        n_commits = 0

        for file_ids in transactions:
            files = sorted(set(file_ids))
            if not files:
                continue
            n_commits += 1
            if len(files) > self.config.max_files_per_commit:
                if self.config.bulk_policy == "exclude":
                    continue
                weight = _commit_weight(len(files), "downweight")
            else:
                weight = 1.0

            for a, b in combinations(files, 2):
                pair_counts[(a, b)] += weight
            for f in files:
                file_counts[f] += 1

        edges = self._topk_edges(pair_counts, file_counts)
        self._write_edges(edges)

    def _topk_edges(
        self,
        pair_counts: dict[tuple[int, int], float],
        file_counts: Counter[int],
    ) -> list[dict[str, object]]:
        neighbors: dict[int, list[tuple[int, float]]] = defaultdict(list)
        for (a, b), count in pair_counts.items():
            neighbors[a].append((b, count))
            neighbors[b].append((a, count))

        edges: list[dict[str, object]] = []
        for src, items in neighbors.items():
            items.sort(key=lambda item: item[1], reverse=True)
            for dst, count in items[: self.config.topk_edges_per_file]:
                ci = file_counts.get(src, 0)
                cj = file_counts.get(dst, 0)
                denom = ci + cj - count
                jaccard = (count / denom) if denom else 0.0
                edges.append(
                    {
                        "src_file_id": src,
                        "dst_file_id": dst,
                        "pair_count": float(count),
                        "src_count": int(ci),
                        "dst_count": int(cj),
                        "weight_jaccard": float(jaccard),
                    }
                )
        return edges

    def _write_edges(self, edges: list[dict[str, object]]) -> None:
        self.paths.ensure_dirs()
        sink = ParquetSink(
            self.paths.edges_dir / "edges_file_topk.parquet",
            pa.schema(
                [
                    ("src_file_id", pa.int64()),
                    ("dst_file_id", pa.int64()),
                    ("pair_count", pa.float64()),
                    ("src_count", pa.int32()),
                    ("dst_count", pa.int32()),
                    ("weight_jaccard", pa.float32()),
                ]
            ),
        )
        sink.write_rows(edges)
        sink.close()
