"""Analysis run management."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from code_intel.config import RepoPaths
from git_analyzer.config import CouplingConfig
from git_analyzer.extract import HistoryExtractor
from git_analyzer.edges import EdgeBuilder
from git_analyzer.mirror import mirror_repo
from code_intel.storage import Storage
from git_analyzer.git import get_head_oid
from code_intel.logging_utils import get_logger
from code_intel_interfaces.analyzer import TaskStatus

logger = get_logger(__name__)


def run_analysis(
    paths: RepoPaths,
    run_id: str,
    repo_path: Path,
    config: CouplingConfig,
    since: str | None = None,
    until: str | None = None,
    progress_callback=None
) -> dict:
    """Execute full analysis pipeline."""
    
    storage = Storage(paths.db_path, paths.parquet_dir)
    
    try:
        storage.update_task(run_id, TaskStatus.RUNNING, started_at=datetime.utcnow().isoformat())
        
        # 1. Mirror
        logger.info("Mirroring repository...")
        mirror_repo(repo_path, paths)
        
        head_oid = get_head_oid(paths.mirror_path)
        # We can store head_oid in metrics for now
        
        # 2. Extract
        logger.info("Extracting history...")
        extractor = HistoryExtractor(paths, config)
        stats = extractor.run(since=since, until=until, progress_callback=progress_callback)
        extractor.close()
        
        metrics = {
            "commit_count": stats.commit_count,
            "git_head_oid": head_oid,
            "skipped_invalid_status": stats.skipped_invalid_status,
            "skipped_invalid_path": stats.skipped_invalid_path,
            "skipped_suspicious_path": stats.skipped_suspicious_path,
            "skipped_incomplete": stats.skipped_incomplete,
            "validation_issues": stats.validation_issues
        }
        
        storage.update_task(
            run_id,
            TaskStatus.RUNNING,
            entity_count=stats.file_count,
            metrics_json=metrics
        )
        
        # Store validation issue samples to DB (capped for performance)
        if stats.issue_samples:
            storage.record_validation_issues_batch(run_id, stats.issue_samples)
            storage.conn.commit()
        
        # 3. Build edges
        logger.info("Building coupling edges...")
        builder = EdgeBuilder(paths, config)
        edge_count = builder.build()
        builder.close()
        
        final_metrics = {**metrics, "edge_count": edge_count}
        
        storage.update_task(
            run_id,
            TaskStatus.COMPLETED,
            relationship_count=edge_count,
            finished_at=datetime.utcnow().isoformat(),
            metrics_json=final_metrics
        )
        
        logger.info(f"Analysis complete: {stats.commit_count} commits, {stats.file_count} files, {edge_count} edges")
        
        return {
            "run_id": run_id,
            "state": "complete",
            "commit_count": stats.commit_count,
            "file_count": stats.file_count,
            "edge_count": edge_count,
            "validation_issues": stats.validation_issues,
            "metrics": final_metrics
        }
    
    except Exception as e:
        logger.exception("Analysis failed")
        storage.update_task(run_id, TaskStatus.FAILED, error=str(e), finished_at=datetime.utcnow().isoformat())
        raise
    
    finally:
        storage.close()


def get_run_status(paths: RepoPaths, run_id: str) -> dict | None:
    """Get status of an analysis task."""
    storage = Storage(paths.db_path, paths.parquet_dir)
    try:
        return storage.get_task(run_id)
    finally:
        storage.close()


def get_latest_run(paths: RepoPaths) -> dict | None:
    """Get the latest analysis task."""
    storage = Storage(paths.db_path, paths.parquet_dir)
    try:
        return storage.get_latest_task(analyzer_type="git")
    finally:
        storage.close()
