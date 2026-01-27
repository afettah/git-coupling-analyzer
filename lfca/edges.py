from __future__ import annotations

import heapq
import math
import sqlite3
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
    merge_policy: str = "include"  # include, exclude, downweight
    merge_downweight: float = 0.5
    spill_threshold: int | None = 200_000


def _commit_weight(tx_size: int, policy: str) -> float:
    if policy == "exclude":
        return 0.0
    return 1.0 / math.log(1.0 + tx_size)


class EdgeBuilder:
    def __init__(self, paths: RepoPaths, config: EdgeConfig | None = None) -> None:
        self.paths = paths
        self.config = config or EdgeConfig()

    def build(self, transactions: Iterable[list[int] | tuple[list[int], float]]) -> None:
        pair_counts: dict[tuple[int, int], float] = defaultdict(float)
        file_counts: Counter[int] = Counter()
        spill_conn = None
        spill_path = None

        if self.config.spill_threshold:
            self.paths.ensure_dirs()
            spill_path = self.paths.edges_dir / "edge_spill.sqlite"
            spill_conn = sqlite3.connect(spill_path)
            spill_conn.execute(
                """
                CREATE TABLE IF NOT EXISTS pair_counts (
                    src_file_id INTEGER NOT NULL,
                    dst_file_id INTEGER NOT NULL,
                    count REAL NOT NULL,
                    PRIMARY KEY (src_file_id, dst_file_id)
                )
                """
            )

        def flush_pairs() -> None:
            if not pair_counts or spill_conn is None:
                return
            spill_conn.executemany(
                """
                INSERT INTO pair_counts (src_file_id, dst_file_id, count)
                VALUES (?, ?, ?)
                ON CONFLICT(src_file_id, dst_file_id)
                DO UPDATE SET count = count + excluded.count
                """,
                [(a, b, count) for (a, b), count in pair_counts.items()],
            )
            spill_conn.commit()
            pair_counts.clear()

        for tx in transactions:
            if isinstance(tx, tuple):
                file_ids, merge_weight = tx
            else:
                file_ids = tx
                merge_weight = 1.0

            files = sorted(set(file_ids))
            if not files:
                continue

            if len(files) > self.config.max_files_per_commit:
                if self.config.bulk_policy == "exclude":
                    continue
                weight = _commit_weight(len(files), "downweight")
            else:
                weight = 1.0

            weight *= merge_weight

            for a, b in combinations(files, 2):
                pair_counts[(a, b)] += weight
            for f in files:
                file_counts[f] += 1

            if (
                spill_conn is not None
                and self.config.spill_threshold
                and len(pair_counts) >= self.config.spill_threshold
            ):
                flush_pairs()

        if spill_conn is not None:
            flush_pairs()
            pairs_iter = spill_conn.execute("SELECT src_file_id, dst_file_id, count FROM pair_counts")
            edges = self._topk_edges(pairs_iter, file_counts)
            spill_conn.close()
            if spill_path:
                spill_path.unlink(missing_ok=True)
        else:
            edges = self._topk_edges(pair_counts.items(), file_counts)

        self._write_edges(edges)

    def _topk_edges(
        self,
        pairs: Iterable[tuple[int, int, float]] | Iterable[tuple[tuple[int, int], float]],
        file_counts: Counter[int],
    ) -> list[dict[str, object]]:
        topk = self.config.topk_edges_per_file
        neighbors: dict[int, list[tuple[float, int]]] = defaultdict(list)

        def update_neighbor(src: int, dst: int, count: float) -> None:
            heap = neighbors[src]
            heapq.heappush(heap, (count, dst))
            if len(heap) > topk:
                heapq.heappop(heap)

        for pair in pairs:
            if isinstance(pair[0], tuple):
                (src, dst), count = pair  # type: ignore[misc]
            else:
                src, dst, count = pair  # type: ignore[misc]
            update_neighbor(src, dst, float(count))
            update_neighbor(dst, src, float(count))

        edges: list[dict[str, object]] = []
        for src, heap in neighbors.items():
            items = sorted(heap, key=lambda item: item[0], reverse=True)
            for count, dst in items:
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
