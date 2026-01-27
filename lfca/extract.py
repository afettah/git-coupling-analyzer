from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from itertools import islice
from pathlib import Path
from typing import Iterable

import pyarrow as pa

from lfca.config import RepoPaths
from lfca.git import CommitHeader, iter_log
from lfca.indexes import FileIndex
from lfca.storage import ParquetSink


@dataclass
class ExtractConfig:
    max_files_per_commit: int = 300
    bulk_policy: str = "downweight"
    merge_policy: str = "include"  # include, exclude, downweight
    parallel_postprocessing: bool = False


@dataclass
class ExtractStats:
    commit_count: int = 0
    change_count: int = 0
    transaction_count: int = 0


class HistoryExtractor:
    def __init__(self, repo_path: Path, paths: RepoPaths, config: ExtractConfig | None = None) -> None:
        self.repo_path = repo_path
        self.paths = paths
        self.config = config or ExtractConfig()

    def run(self, since: str | None = None, until: str | None = None) -> ExtractStats:
        self.paths.ensure_dirs()
        index = FileIndex(self.paths.indexes_dir / "file_index.sqlite")

        commits_sink = ParquetSink(
            self.paths.artifacts_root / "commits.parquet",
            pa.schema(
                [
                    ("commit_oid", pa.string()),
                    ("author_name", pa.string()),
                    ("author_email", pa.string()),
                    ("authored_ts", pa.timestamp("s")),
                    ("committer_ts", pa.timestamp("s")),
                    ("is_merge", pa.bool_()),
                    ("parent_count", pa.int32()),
                    ("message_subject", pa.string()),
                ]
            ),
        )
        changes_sink = ParquetSink(
            self.paths.artifacts_root / "changes.parquet",
            pa.schema(
                [
                    ("commit_oid", pa.string()),
                    ("file_id", pa.int64()),
                    ("path", pa.string()),
                    ("status", pa.string()),
                    ("old_path", pa.string()),
                    ("commit_ts", pa.timestamp("s")),
                ]
            ),
        )
        transactions_sink = ParquetSink(
            self.paths.artifacts_root / "transactions.parquet",
            pa.schema(
                [
                    ("commit_oid", pa.string()),
                    ("file_id", pa.int64()),
                    ("commit_ts", pa.timestamp("s")),
                ]
            ),
        )

        lineage_open: dict[int, tuple[str, str]] = {}
        stats = ExtractStats()
        file_commit_counts: Counter[int] = Counter()

        path_cache: dict[str, int] = {}

        for header, changes in iter_log(self.repo_path, since=since, until=until):
            stats.commit_count += 1
            is_merge = len(header.parents) > 1
            include_in_edges = not (is_merge and self.config.merge_policy == "exclude")
            commits_sink.write_rows(
                [
                    {
                        "commit_oid": header.commit_oid,
                        "author_name": header.author_name,
                        "author_email": header.author_email,
                        "authored_ts": header.authored_ts,
                        "committer_ts": header.committer_ts,
                        "is_merge": is_merge,
                        "parent_count": len(header.parents),
                        "message_subject": header.subject,
                    }
                ]
            )

            file_ids_in_commit: set[int] = set()
            change_rows = []
            tx_rows = []

            with index.transaction():
                for status, path, old_path in changes:
                    if not path:
                        continue

                    file_id = None
                    if old_path:
                        file_id = path_cache.get(old_path)
                        if file_id is None:
                            file_id = index.get_file_id(old_path)
                    if file_id is None:
                        file_id = path_cache.get(path)
                    if file_id is None:
                        file_id = index.get_file_id(path)

                    if file_id is None:
                        file_id = index.next_file_id()
                        index.set_file_id(file_id, path)
                        lineage_open[file_id] = (path, header.commit_oid)
                    else:
                        index.update_path(file_id, path)

                    path_cache[path] = file_id
                    if old_path:
                        path_cache.pop(old_path, None)

                    if file_id in lineage_open:
                        previous_path, start_commit = lineage_open[file_id]
                        if previous_path != path:
                            index.add_lineage(file_id, previous_path, start_commit, header.commit_oid)
                            lineage_open[file_id] = (path, header.commit_oid)

                    change_rows.append(
                        {
                            "commit_oid": header.commit_oid,
                            "file_id": file_id,
                            "path": path,
                            "status": status,
                            "old_path": old_path,
                            "commit_ts": header.committer_ts,
                        }
                    )
                    file_ids_in_commit.add(file_id)

            stats.change_count += len(change_rows)
            changes_sink.write_rows(change_rows)

            if include_in_edges:
                for file_id in file_ids_in_commit:
                    tx_rows.append(
                        {
                            "commit_oid": header.commit_oid,
                            "file_id": file_id,
                            "commit_ts": header.committer_ts,
                        }
                    )
                    file_commit_counts[file_id] += 1

            stats.transaction_count += len(tx_rows)
            transactions_sink.write_rows(tx_rows)

        for file_id, (path, start_commit) in lineage_open.items():
            index.add_lineage(file_id, path, start_commit, None)

        commits_sink.close()
        changes_sink.close()
        transactions_sink.close()
        index.close()

        if self.config.parallel_postprocessing:
            from concurrent.futures import ThreadPoolExecutor

            with ThreadPoolExecutor() as executor:
                stats_future = executor.submit(self._write_file_stats, file_commit_counts)
                lineage_future = executor.submit(self._write_lineage)
                stats_future.result()
                lineage_future.result()
        else:
            self._write_file_stats(file_commit_counts)
            self._write_lineage()
        return stats

    def _write_file_stats(self, file_commit_counts: Counter[int]) -> None:
        index = FileIndex(self.paths.indexes_dir / "file_index.sqlite")
        sink = ParquetSink(
            self.paths.artifacts_root / "file_stats.parquet",
            pa.schema(
                [
                    ("file_id", pa.int64()),
                    ("path_current", pa.string()),
                    ("commit_count", pa.int32()),
                ]
            ),
        )
        batch_size = 1000
        cursor = index._conn.execute("SELECT file_id, path_current FROM file_index")
        while True:
            rows = cursor.fetchmany(batch_size)
            if not rows:
                break
            sink.write_rows(
                [
                    {
                        "file_id": file_id,
                        "path_current": path,
                        "commit_count": int(file_commit_counts.get(file_id, 0)),
                    }
                    for file_id, path in rows
                ]
            )
        sink.close()
        index.close()

    def _write_lineage(self) -> None:
        index = FileIndex(self.paths.indexes_dir / "file_index.sqlite")
        sink = ParquetSink(
            self.paths.artifacts_root / "file_lineage.parquet",
            pa.schema(
                [
                    ("file_id", pa.int64()),
                    ("path", pa.string()),
                    ("start_commit_oid", pa.string()),
                    ("end_commit_oid", pa.string()),
                ]
            ),
        )
        batch_size = 1000
        iterator = iter(index.iter_lineage())
        while True:
            batch = list(islice(iterator, batch_size))
            if not batch:
                break
            sink.write_rows(
                [
                    {
                        "file_id": file_id,
                        "path": path,
                        "start_commit_oid": start_commit,
                        "end_commit_oid": end_commit,
                    }
                    for file_id, path, start_commit, end_commit in batch
                ]
            )
        sink.close()
        index.close()
