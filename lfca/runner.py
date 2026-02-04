"""Analysis run management."""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path

from lfca.config import RepoPaths, CouplingConfig
from lfca.extract import HistoryExtractor
from lfca.edges import EdgeBuilder
from lfca.mirror import mirror_repo
from lfca.storage import Storage
from lfca.git import get_head_oid
from lfca.logging_utils import get_logger

logger = get_logger(__name__)


def create_run(paths: RepoPaths, config: CouplingConfig) -> str:
    """Create a new analysis run."""
    run_id = uuid.uuid4().hex[:12]
    
    storage = Storage(paths.db_path, paths.parquet_dir)
    storage.conn.execute("""
        INSERT INTO analysis_runs (run_id, state, config_json, created_at)
        VALUES (?, 'pending', ?, ?)
    """, (run_id, json.dumps(config.to_dict()), datetime.utcnow().isoformat()))
    storage.conn.commit()
    storage.close()
    
    return run_id


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
    
    def update_state(state: str, **kwargs):
        sets = ", ".join(f"{k} = ?" for k in kwargs.keys())
        if sets:
            sets = ", " + sets
        storage.conn.execute(f"""
            UPDATE analysis_runs SET state = ?{sets} WHERE run_id = ?
        """, [state] + list(kwargs.values()) + [run_id])
        storage.conn.commit()
    
    try:
        update_state("running", started_at=datetime.utcnow().isoformat())
        
        # 1. Mirror
        logger.info("Mirroring repository...")
        mirror_repo(repo_path, paths)
        
        head_oid = get_head_oid(paths.mirror_path)
        update_state("running", git_head_oid=head_oid)
        
        # 2. Extract
        logger.info("Extracting history...")
        extractor = HistoryExtractor(paths, config)
        stats = extractor.run(since=since, until=until, progress_callback=progress_callback)
        extractor.close()
        
        update_state(
            "running",
            commit_count=stats.commit_count,
            file_count=stats.file_count,
            skipped_invalid_status=stats.skipped_invalid_status,
            skipped_invalid_path=stats.skipped_invalid_path,
            skipped_suspicious_path=stats.skipped_suspicious_path,
            skipped_incomplete=stats.skipped_incomplete,
            validation_issues=stats.validation_issues
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
        
        update_state(
            "complete",
            edge_count=edge_count,
            finished_at=datetime.utcnow().isoformat()
        )
        
        logger.info(f"Analysis complete: {stats.commit_count} commits, {stats.file_count} files, {edge_count} edges")
        if stats.validation_issues > 0:
            logger.warning(f"Validation issues: {stats.validation_issues} total "
                         f"({stats.skipped_invalid_status} invalid status, "
                         f"{stats.skipped_invalid_path} invalid paths, "
                         f"{stats.skipped_suspicious_path} suspicious paths, "
                         f"{stats.skipped_incomplete} incomplete changes)")
        
        return {
            "run_id": run_id,
            "state": "complete",
            "commit_count": stats.commit_count,
            "file_count": stats.file_count,
            "edge_count": edge_count,
            "validation_issues": stats.validation_issues,
            "skipped_invalid_status": stats.skipped_invalid_status,
            "skipped_invalid_path": stats.skipped_invalid_path,
            "skipped_suspicious_path": stats.skipped_suspicious_path,
            "skipped_incomplete": stats.skipped_incomplete,
        }
    
    except Exception as e:
        logger.exception("Analysis failed")
        update_state("failed", error=str(e), finished_at=datetime.utcnow().isoformat())
        raise
    
    finally:
        storage.close()


def get_run_status(paths: RepoPaths, run_id: str) -> dict | None:
    """Get status of an analysis run."""
    storage = Storage(paths.db_path, paths.parquet_dir)
    try:
        row = storage.conn.execute("""
            SELECT run_id, state, config_json, git_head_oid, commit_count, file_count,
                   edge_count, started_at, finished_at, error, created_at
            FROM analysis_runs WHERE run_id = ?
        """, (run_id,)).fetchone()
        
        if not row:
            return None
        
        return {
            "run_id": row[0],
            "state": row[1],
            "config": json.loads(row[2]) if row[2] else None,
            "git_head_oid": row[3],
            "commit_count": row[4],
            "file_count": row[5],
            "edge_count": row[6],
            "started_at": row[7],
            "finished_at": row[8],
            "error": row[9],
            "created_at": row[10]
        }
    finally:
        storage.close()


def get_latest_run(paths: RepoPaths) -> dict | None:
    """Get the latest analysis run."""
    storage = Storage(paths.db_path, paths.parquet_dir)
    try:
        row = storage.conn.execute("""
            SELECT run_id, state, config_json, git_head_oid, commit_count, file_count,
                   edge_count, started_at, finished_at, error, created_at
            FROM analysis_runs ORDER BY created_at DESC LIMIT 1
        """).fetchone()
        
        if not row:
            return None
        
        return {
            "run_id": row[0],
            "state": row[1],
            "config": json.loads(row[2]) if row[2] else None,
            "git_head_oid": row[3],
            "commit_count": row[4],
            "file_count": row[5],
            "edge_count": row[6],
            "started_at": row[7],
            "finished_at": row[8],
            "error": row[9],
            "created_at": row[10]
        }
    finally:
        storage.close()
