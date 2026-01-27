from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from itertools import islice
from pathlib import Path
from typing import Callable, Iterable

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


from lfca.logging_utils import get_logger

logger = get_logger(__name__)

class HistoryExtractor:
    def __init__(self, repo_path: Path, paths: RepoPaths, config: ExtractConfig | None = None) -> None:
        self.repo_path = repo_path
        self.paths = paths
        self.config = config or ExtractConfig()

    def run(
        self,
        since: str | None = None,
        until: str | None = None,
        progress_callback: Callable[[int], None] | None = None,
    ) -> ExtractStats:
        logger.info(f"Starting extraction for {self.repo_path} (since={since}, until={until})")
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

        # path -> file_id for the current traversal state (backwards)
        path_cache: dict[str, int] = {}

        for header, changes in iter_log(self.repo_path, since=since, until=until):
            stats.commit_count += 1
            if progress_callback:
                progress_callback(stats.commit_count)
            
            if stats.commit_count % 1000 == 0:
                logger.info(f"Processed {stats.commit_count} commits...")

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
                    
                    # In backwards traversal:
                    # R old_path path  => path existed, now it "becomes" old_path
                    # D path           => path was gone, now it "appears" (new file_id)
                    # A path           => path existed, now it's "unborn" (clear tracking)
                    # M path           => path existed, continues to exist

                    if status.startswith("R") or status.startswith("C"):
                        # Rename/Copy: find the file_id of the CURRENT path
                        file_id = path_cache.get(path)
                        if file_id is None:
                            file_id = index.get_file_id(path)
                        
                        if file_id is not None:
                            # It's now at old_path (going backwards)
                            index.update_path(file_id, old_path)
                            path_cache[old_path] = file_id
                            path_cache.pop(path, None)
                        else:
                            # Shouldn't happen if we have full history, but for incremental:
                            file_id = index.next_file_id()
                            index.set_file_id(file_id, old_path, path_latest=path)
                            path_cache[old_path] = file_id
                            lineage_open[file_id] = (old_path, header.commit_oid)

                    elif status == "D":
                        # Deleted (in Git): it re-appears here (going backwards)
                        file_id = index.next_file_id()
                        index.set_file_id(file_id, path, path_latest=path)
                        path_cache[path] = file_id
                        lineage_open[file_id] = (path, header.commit_oid)

                    elif status == "A":
                        # Added (in Git): it disappears here (going backwards)
                        file_id = path_cache.get(path)
                        if file_id is None:
                            file_id = index.get_file_id(path)
                        
                        if file_id is None:
                            # Not tracked yet, just create it for this commit context
                            file_id = index.next_file_id()
                            index.set_file_id(file_id, path, path_latest=path)
                        
                        # Stop tracking this path for this file_id as we go further back
                        # We use a special path or just remove it. 
                        # To keep UNIQUE constraint clean, we use a tombstone or just remove.
                        # Since it's 'Added' here, it won't exist before this commit.
                        # Removing from file_index is best.
                        self._clear_file_mapping(index, file_id)
                        path_cache.pop(path, None)

                    else: # Modified or other
                        file_id = path_cache.get(path)
                        if file_id is None:
                            file_id = index.get_file_id(path)
                        
                        if file_id is None:
                            file_id = index.next_file_id()
                            index.set_file_id(file_id, path, path_latest=path)
                            path_cache[path] = file_id
                            lineage_open[file_id] = (path, header.commit_oid)

                    # Update lineage if path changed
                    if file_id in lineage_open:
                        previous_path, start_commit = lineage_open[file_id]
                        current_tracked_path = old_path if (status.startswith("R") or status.startswith("C")) else path
                        if previous_path != current_tracked_path:
                            index.add_lineage(file_id, previous_path, start_commit, header.commit_oid)
                            lineage_open[file_id] = (current_tracked_path, header.commit_oid)

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

        logger.info("Closing open lineage entries...")
        for file_id, (path, start_commit) in lineage_open.items():
            index.add_lineage(file_id, path, start_commit, None)

        commits_sink.close()
        changes_sink.close()
        transactions_sink.close()
        index.close()

        logger.info("Writing file stats and lineage...")
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
        
        logger.info(f"Extraction complete: {stats.commit_count} commits, {stats.change_count} changes.")
        return stats

    def _clear_file_mapping(self, index: FileIndex, file_id: int) -> None:
        # Instead of deleting (which might break file_id referential integrity in parquet),
        # we set path_current to something that won't collide.
        # But wait, path_current IS used for stats. 
        # Actually, if we are done with this file in history, 
        # we can set it to "path:unborn:<commit_oid>" or similar.
        # However, it's easier to just remove it from file_index table if it's only used for tracking.
        # The 'file_stats' later will use file_index to get path_current.
        index._conn.execute("UPDATE file_index SET path_current = '__unborn:' || file_id WHERE file_id = ?", (file_id,))

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
        cursor = index._conn.execute("SELECT file_id, COALESCE(path_latest, path_current) FROM file_index")
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

