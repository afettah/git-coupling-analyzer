"""Git history extraction."""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from fnmatch import fnmatch
from pathlib import Path
from typing import Callable, List

import pyarrow as pa

from code_intel.config import RepoPaths, ValidationMode
from git_analyzer.config import CouplingConfig
from git_analyzer.git import iter_log, iter_numstat, ValidationIssue
from git_analyzer.file_metrics import materialize_hot_stable_metrics
from code_intel.storage import Storage
from git_analyzer.sync import sync_head_files
from code_intel.logging_utils import get_logger

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
        config: CouplingConfig | None = None,
        storage: Storage | None = None,
    ):
        self.paths = paths
        self.config = config or CouplingConfig()
        self._owns_storage = storage is None
        self.storage = storage or Storage(paths.db_path, paths.parquet_dir)
    
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
        file_authors: dict[int, set[str]] = {}  # file_id -> set of author emails
        file_line_stats: dict[int, dict[str, int]] = {}  # file_id -> {added, deleted}
        file_timestamps: dict[int, dict[str, int]] = {}  # file_id -> {first, last}
        entity_cache: dict[str, int] = {}
        max_issues = self.config.max_validation_issues
        if max_issues is None:
            max_issues = 1_000_000
        
        # Collect commits for Parquet
        commits_data = []
        changes_data = []

        effective_since = since
        if not effective_since and self.config.window_days:
            cutoff = datetime.now(timezone.utc) - timedelta(days=self.config.window_days)
            effective_since = cutoff.strftime("%Y-%m-%d")

        # Build a fast lookup for line churn by (commit_oid, path).
        numstat_lookup: dict[tuple[str, str], tuple[int, int]] = {}
        for commit_oid, rows in iter_numstat(
            self.paths.mirror_path,
            since=effective_since,
            until=until,
            ref=self.config.ref,
            all_refs=self.config.all_refs,
            skip_merge_commits=self.config.skip_merge_commits,
            first_parent_only=self.config.first_parent_only,
            find_renames_threshold=self.config.find_renames_threshold,
        ):
            for path, added, deleted in rows:
                numstat_lookup[(commit_oid, path)] = (added, deleted)

        def get_or_create_cached_entity(path: str) -> int:
            cached = entity_cache.get(path)
            if cached is not None:
                return cached
            existing = self.storage.get_entity_by_qualified_name(path, kind="file")
            if existing:
                entity_cache[path] = existing["entity_id"]
                return existing["entity_id"]
            entity_id = self.storage.get_or_create_entity(
                kind="file",
                name=Path(path).name,
                qualified_name=path,
                metadata_json={"exists_at_head": True},
            )
            entity_cache[path] = entity_id
            return entity_id

        include_patterns = self.config.include_paths or []
        exclude_patterns = self.config.exclude_paths or []
        include_exts = {ext.lower() for ext in (self.config.include_extensions or [])}
        exclude_exts = {ext.lower() for ext in (self.config.exclude_extensions or [])}

        def in_scope(path: str) -> bool:
            extension = Path(path).suffix.lower()
            if include_exts and extension not in include_exts:
                return False
            if exclude_exts and extension in exclude_exts:
                return False
            if include_patterns and not any(fnmatch(path, pattern) for pattern in include_patterns):
                return False
            if exclude_patterns and any(fnmatch(path, pattern) for pattern in exclude_patterns):
                return False
            return True
        
        # Process git log from MIRROR with validation mode
        for header, changes in iter_log(
            self.paths.mirror_path,
            since=effective_since,
            until=until,
            ref=self.config.ref,
            all_refs=self.config.all_refs,
            skip_merge_commits=self.config.skip_merge_commits,
            first_parent_only=self.config.first_parent_only,
            find_renames_threshold=self.config.find_renames_threshold,
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
            for status, path, old_path in changes:
                if not path:
                    continue
                if not in_scope(path):
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

                # Handle renames: reuse old entity and update path
                if old_path and (status.startswith("R") or status.startswith("C")):
                    old_entity = self.storage.get_entity_by_qualified_name(old_path, kind="file")
                    if old_entity:
                        file_id = old_entity["entity_id"]
                        existing_target = self.storage.get_entity_by_qualified_name(path, kind="file")
                        if existing_target and existing_target["entity_id"] != file_id:
                            self.storage.conn.execute(
                                "UPDATE entities SET exists_at_head = FALSE WHERE entity_id = ?",
                                (file_id,),
                            )
                            file_id = existing_target["entity_id"]
                        else:
                            self.storage.conn.execute(
                                "UPDATE entities SET qualified_name = ?, name = ?, updated_at = CURRENT_TIMESTAMP WHERE entity_id = ?",
                                (path, Path(path).name, file_id),
                            )
                        entity_cache.pop(old_path, None)
                        entity_cache[path] = file_id
                    else:
                        file_id = get_or_create_cached_entity(path)
                else:
                    file_id = get_or_create_cached_entity(path)

                file_ids_in_commit.add(file_id)

                lines_added, lines_deleted = numstat_lookup.get(
                    (header.commit_oid, path),
                    numstat_lookup.get((header.commit_oid, old_path or ""), (0, 0)),
                )
                if file_id not in file_line_stats:
                    file_line_stats[file_id] = {"added": 0, "deleted": 0}
                file_line_stats[file_id]["added"] += int(lines_added)
                file_line_stats[file_id]["deleted"] += int(lines_deleted)

                changes_data.append(
                    {
                        "commit_oid": header.commit_oid,
                        "file_id": file_id,
                        "path": path,
                        "status": status,
                        "old_path": old_path,
                        "commit_ts": header.committer_ts,
                        "lines_added": int(lines_added),
                        "lines_deleted": int(lines_deleted),
                    }
                )

                if old_path and (status.startswith("R") or status.startswith("C")):
                    self._record_rename(file_id, old_path, path, header.commit_oid)
            
            # Update file commit counts and stats
            for fid in file_ids_in_commit:
                file_commit_counts[fid] += 1
                
                # Track authors
                if fid not in file_authors:
                    file_authors[fid] = set()
                file_authors[fid].add(header.author_email)
                
                # Track timestamps
                if fid not in file_timestamps:
                    file_timestamps[fid] = {
                        "first": header.committer_ts,
                        "last": header.committer_ts
                    }
                else:
                    file_timestamps[fid]["last"] = max(
                        file_timestamps[fid]["last"], header.committer_ts
                    )
                    file_timestamps[fid]["first"] = min(
                        file_timestamps[fid]["first"], header.committer_ts
                    )
                
                # Initialize line stats (will be computed from numstat if available)
                if fid not in file_line_stats:
                    file_line_stats[fid] = {"added": 0, "deleted": 0}
            
            stats.change_count += len(changes)
            if stats.commit_count % 500 == 0:
                self.storage.conn.commit()
                stats.transaction_count += 1

        self.storage.conn.commit()
        stats.transaction_count += 1
        
        # Write Parquet files
        self._write_parquet("commits", commits_data)
        self._write_parquet("changes", changes_data)
        
        # Update file stats with all pre-computed data
        self._update_file_stats(
            file_commit_counts, file_authors, file_line_stats, file_timestamps
        )

        # Canonical hot/stable activity classification for all files.
        materialize_hot_stable_metrics(self.storage, self.paths.parquet_dir)
        
        # Save repo-level summary for dashboard
        self._save_repo_summary(stats, file_commit_counts, file_authors, file_line_stats)
        
        # Sync HEAD
        sync_head_files(self.paths, self.storage)
        
        stats.file_count = len(file_commit_counts)
        logger.info(f"Extraction complete: {stats.commit_count} commits, {stats.file_count} files")
        
        return stats
    
    def _record_rename(self, file_id: int, old_path: str, new_path: str, commit_oid: str):
        """Record file rename in lineage."""
        self.storage.conn.execute(
            """
            UPDATE git_file_lineage
            SET end_commit_oid = ?
            WHERE entity_id = ? AND path = ? AND end_commit_oid IS NULL
            """,
            (commit_oid, file_id, old_path),
        )
        existing_open = self.storage.conn.execute(
            """
            SELECT 1 FROM git_file_lineage
            WHERE entity_id = ? AND path = ? AND end_commit_oid IS NULL
            LIMIT 1
            """,
            (file_id, new_path),
        ).fetchone()
        if not existing_open:
            self.storage.conn.execute(
                """
                INSERT INTO git_file_lineage (entity_id, path, start_commit_oid, end_commit_oid)
                VALUES (?, ?, ?, NULL)
                """,
                (file_id, new_path, commit_oid),
            )
    
    def _update_file_stats(
        self,
        counts: Counter[int],
        authors: dict[int, set[str]],
        line_stats: dict[int, dict[str, int]],
        timestamps: dict[int, dict[str, int]],
    ):
        """Update metadata for entities with comprehensive stats."""
        for entity_id, count in counts.items():
            # Merge with existing metadata
            row = self.storage.conn.execute(
                "SELECT metadata_json FROM entities WHERE entity_id = ?", (entity_id,)
            ).fetchone()
            meta = json.loads(row[0]) if row and row[0] else {}
            
            # Update all stats
            meta["total_commits"] = count
            meta["authors_count"] = len(authors.get(entity_id, set()))
            meta["total_lines_added"] = line_stats.get(entity_id, {}).get("added", 0)
            meta["total_lines_deleted"] = line_stats.get(entity_id, {}).get("deleted", 0)
            
            ts = timestamps.get(entity_id, {})
            if "first" in ts:
                meta["first_commit_ts"] = ts["first"]
            if "last" in ts:
                meta["last_commit_ts"] = ts["last"]
            
            self.storage.conn.execute(
                "UPDATE entities SET metadata_json = ? WHERE entity_id = ?",
                (json.dumps(meta), entity_id)
            )
        self.storage.conn.commit()
    
    def _save_repo_summary(
        self,
        stats: ExtractStats,
        file_commit_counts: Counter[int],
        file_authors: dict[int, set[str]],
        line_stats: dict[int, dict[str, int]],
    ):
        """Save repo-level summary stats for fast dashboard queries."""
        # Aggregate all authors
        all_authors = set()
        for authors_set in file_authors.values():
            all_authors.update(authors_set)
        
        # Aggregate lines
        total_lines_added = sum(s.get("added", 0) for s in line_stats.values())
        total_lines_deleted = sum(s.get("deleted", 0) for s in line_stats.values())
        
        # Count hotspots (files with >50 commits)
        hotspot_threshold = max(1, self.config.hotspot_threshold)
        hotspot_count = sum(1 for count in file_commit_counts.values() if count >= hotspot_threshold)
        
        summary = {
            "file_count": len(file_commit_counts),
            "commit_count": stats.commit_count,
            "totalAuthors": len(all_authors),
            "linesAdded": total_lines_added,
            "linesDeleted": total_lines_deleted,
            "hotspotCount": hotspot_count,
            "hotspotThreshold": hotspot_threshold,
            "avgCoupling": 0.0,  # Will be computed after edges analysis
            "riskScore": 0.0,  # Will be computed after edges analysis
        }
        
        self.storage.conn.execute(
            "INSERT OR REPLACE INTO repo_meta (key, value) VALUES (?, ?)",
            ("summary_stats", json.dumps(summary))
        )
        self.storage.conn.commit()
    
    def _write_parquet(self, name: str, data: list[dict]):
        """Write data to Parquet."""
        if not data:
            return
        table = pa.Table.from_pylist(data)
        self.storage.write_parquet(name, table)
    
    def close(self):
        if self._owns_storage:
            self.storage.close()
