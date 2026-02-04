"""Git history extraction."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, List

import pyarrow as pa

from lfca.config import RepoPaths, CouplingConfig, ValidationMode
from lfca.git import iter_log, ValidationIssue
from lfca.storage import Storage
from lfca.sync import sync_head_files
from lfca.logging_utils import get_logger

logger = get_logger(__name__)


@dataclass
class ExtractStats:
    commit_count: int = 0
    file_count: int = 0
    change_count: int = 0
    transaction_count: int = 0
    skipped_invalid_status: int = 0
    skipped_invalid_path: int = 0
    skipped_suspicious_path: int = 0
    skipped_incomplete: int = 0
    validation_issues: int = 0
    # Capped sample of issues for logging (avoid memory bloat)
    issue_samples: List[ValidationIssue] = field(default_factory=list)


class HistoryExtractor:
    def __init__(
        self, 
        paths: RepoPaths, 
        config: CouplingConfig | None = None
    ):
        self.paths = paths
        self.config = config or CouplingConfig()
        self.storage = Storage(paths.db_path, paths.parquet_dir)
    
    def run(
        self,
        since: str | None = None,
        until: str | None = None,
        progress_callback: Callable[[int], None] | None = None,
    ) -> ExtractStats:
        """Run extraction from mirror."""
        logger.info(f"Starting extraction (since={since}, until={until}, mode={self.config.validation_mode.value})")
        self.paths.ensure_dirs()
        
        stats = ExtractStats()
        file_commit_counts: Counter[int] = Counter()
        max_issues = self.config.max_validation_issues
        
        # Collect commits for Parquet
        commits_data = []
        changes_data = []
        
        # Process git log from MIRROR with validation mode
        for header, changes in iter_log(
            self.paths.mirror_path,
            since=since,
            until=until,
            validation_mode=self.config.validation_mode.value,
        ):
            stats.commit_count += 1
            
            # Record validation issues from git log parsing (with cap)
            if header.validation_issues:
                for issue in header.validation_issues:
                    stats.validation_issues += 1
                    
                    # Count by type
                    if issue.issue_type == "invalid_status":
                        stats.skipped_invalid_status += 1
                    elif issue.issue_type == "invalid_path":
                        stats.skipped_invalid_path += 1
                    elif issue.issue_type == "incomplete_change":
                        stats.skipped_incomplete += 1
                    
                    # Keep sample of issues (capped for performance)
                    if len(stats.issue_samples) < max_issues:
                        stats.issue_samples.append(issue)
            
            if progress_callback and stats.commit_count % 100 == 0:
                progress_callback(stats.commit_count)
            
            if stats.commit_count % 1000 == 0:
                logger.info(f"Processed {stats.commit_count} commits...")
            
            # Skip large changesets
            if len(changes) > self.config.max_changeset_size:
                continue
            
            is_merge = len(header.parents) > 1
            
            commits_data.append({
                "commit_oid": header.commit_oid,
                "author_name": header.author_name,
                "author_email": header.author_email,
                "authored_ts": header.authored_ts,
                "committer_ts": header.committer_ts,
                "is_merge": is_merge,
                "parent_count": len(header.parents),
                "message_subject": header.subject,
            })
            
            file_ids_in_commit = set()
            
            with self.storage.transaction():
                for status, path, old_path in changes:
                    if not path:
                        continue
                    
                    # Defense-in-depth: skip invalid paths that leaked through
                    if len(path) <= 3 and path.isalpha():
                        logger.warning(f"Skipping invalid path: {path!r}")
                        stats.skipped_suspicious_path += 1
                        continue
                    if not ('/' in path or '.' in path):
                        if len(path) < 10:  # Short paths without / or . are suspicious
                            logger.warning(f"Skipping suspicious path: {path!r}")
                            stats.skipped_suspicious_path += 1
                            continue
                    
                    # Get or create file
                    file_id = self.storage.get_or_create_file(path)
                    file_ids_in_commit.add(file_id)
                    
                    changes_data.append({
                        "commit_oid": header.commit_oid,
                        "file_id": file_id,
                        "path": path,
                        "status": status,
                        "old_path": old_path,
                        "commit_ts": header.committer_ts,
                    })
                    
                    # Track renames
                    if old_path and (status.startswith("R") or status.startswith("C")):
                        self._record_rename(file_id, old_path, path, header.commit_oid)
            
            # Update file commit counts
            for fid in file_ids_in_commit:
                file_commit_counts[fid] += 1
            
            stats.change_count += len(changes)
        
        # Write Parquet files
        self._write_parquet("commits", commits_data)
        self._write_parquet("changes", changes_data)
        
        # Update file stats
        self._update_file_stats(file_commit_counts)
        
        # Sync HEAD
        sync_head_files(self.paths, self.storage)
        
        stats.file_count = len(file_commit_counts)
        logger.info(f"Extraction complete: {stats.commit_count} commits, {stats.file_count} files")
        
        return stats
    
    def _record_rename(self, file_id: int, old_path: str, new_path: str, commit_oid: str):
        """Record file rename in lineage."""
        self.storage.conn.execute("""
            INSERT OR IGNORE INTO file_lineage (file_id, path, start_commit_oid, end_commit_oid)
            VALUES (?, ?, ?, NULL)
        """, (file_id, old_path, commit_oid))
    
    def _update_file_stats(self, counts: Counter[int]):
        """Update total_commits for files."""
        for file_id, count in counts.items():
            self.storage.conn.execute(
                "UPDATE files SET total_commits = ? WHERE file_id = ?",
                (count, file_id)
            )
        self.storage.conn.commit()
    
    def _write_parquet(self, name: str, data: list[dict]):
        """Write data to Parquet."""
        if not data:
            return
        table = pa.Table.from_pylist(data)
        self.storage.write_parquet(name, table)
    
    def close(self):
        self.storage.close()
