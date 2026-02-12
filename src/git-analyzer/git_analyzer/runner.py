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
from git_analyzer.git import get_head_oid, count_commits
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
        # Task status is already set to RUNNING by orchestrator
        # Just update progress as we go
        
        # 1. Mirror
        storage.update_task(
            run_id,
            TaskStatus.RUNNING,
            stage="mirroring",
            progress=0.05,
        )
        logger.info("Mirroring repository...")
        mirror_repo(repo_path, paths)
        
        head_oid = get_head_oid(paths.mirror_path)
        # We can store head_oid in metrics for now

        effective_since = since
        if not effective_since and config.window_days:
            from datetime import timezone, timedelta
            effective_since = (
                datetime.now(timezone.utc) - timedelta(days=config.window_days)
            ).strftime("%Y-%m-%d")
        total_commits = count_commits(paths.mirror_path, since=effective_since, until=until)
        progress_state = {"processed_commits": 0, "total_commits": total_commits}
        
        # 2. Extract
        storage.update_task(
            run_id,
            TaskStatus.RUNNING,
            stage="extracting_history",
            progress=0.1,
            metrics_json=progress_state,
        )
        logger.info("Extracting history...")
        extractor = HistoryExtractor(paths, config, storage=storage)
        
        def _on_progress(processed_commits: int) -> None:
            progress_state["processed_commits"] = processed_commits
            progress_ratio = 0.1
            if total_commits > 0:
                progress_ratio = 0.1 + min(0.55, (processed_commits / total_commits) * 0.55)
            storage.update_task(
                run_id,
                TaskStatus.RUNNING,
                stage="extracting_history",
                progress=progress_ratio,
                metrics_json=progress_state,
            )
            if progress_callback:
                progress_callback(processed_commits)

        stats = extractor.run(since=since, until=until, progress_callback=_on_progress)
        extractor.close()
        
        metrics = {
            "commit_count": stats.commit_count,
            "processed_commits": stats.commit_count,
            "total_commits": total_commits,
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
            stage="building_edges",
            progress=0.75,
            entity_count=stats.file_count,
            metrics_json=metrics
        )
        
        # Store validation issue samples to DB (capped for performance)
        if stats.issue_samples:
            storage.record_validation_issues_batch(run_id, stats.issue_samples)
            storage.conn.commit()
        
        # 3. Build edges
        logger.info("Building coupling edges...")
        builder = EdgeBuilder(paths, config, storage=storage)
        edge_count = builder.build()
        builder.close()
        
        final_metrics = {**metrics, "edge_count": edge_count}
        
        storage.update_task(
            run_id,
            TaskStatus.COMPLETED,
            stage="completed",
            progress=1.0,
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
