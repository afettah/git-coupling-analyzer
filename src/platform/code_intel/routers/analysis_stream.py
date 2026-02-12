from __future__ import annotations

import asyncio
import json
import sqlite3
from pathlib import Path
from time import monotonic

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from code_intel.config import RepoPaths, DEFAULT_DATA_DIR
from code_intel.logging_utils import get_logger
from code_intel.storage import Storage

# TODO (ISSUE 014): Add progressive polling intervals to reduce DB pressure
router = APIRouter(prefix="/repos/{repo_id}/analysis", tags=["analysis-stream"])
logger = get_logger(__name__)


def _storage(repo_id: str, data_dir: str = Query(default=None)) -> Storage:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    paths = RepoPaths(Path(data_dir), repo_id)
    return Storage(paths.db_path, paths.parquet_dir)


def _to_progress_payload(task: dict | None, elapsed_seconds: float) -> dict:
    if not task:
        return {
            "state": "not_found",
            "stage": "not_found",
            "progress": 0.0,
            "processed_commits": 0,
            "total_commits": 0,
            "entity_count": 0,
            "relationship_count": 0,
            "elapsed_seconds": int(elapsed_seconds),
            "error": "Task not found",
        }

    metrics = task.get("metrics", {}) or {}
    total_commits = int(metrics.get("total_commits") or metrics.get("commit_count") or 0)
    processed_commits = int(metrics.get("processed_commits") or 0)

    payload = {
        "state": task.get("state") or "pending",
        "stage": task.get("stage") or "pending",
        "progress": float(task.get("progress") or 0.0),
        "processed_commits": processed_commits,
        "total_commits": total_commits,
        "entity_count": int(task.get("entity_count") or 0),
        "relationship_count": int(task.get("relationship_count") or 0),
        "elapsed_seconds": int(elapsed_seconds),
        "error": task.get("error"),
    }

    if payload["state"] == "completed":
        payload["progress"] = 1.0

    return payload


@router.get("/runs/{run_id}/stream")
async def stream_run_progress(repo_id: str, run_id: str, data_dir: str = Query(default=None)):
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    async def _stream():
        started = monotonic()
        last_payload: dict | None = None
        storage = _storage(repo_id, data_dir)
        try:
            for _ in range(3600):
                try:
                    task = storage.get_task(run_id)
                except sqlite3.OperationalError as exc:
                    if "locked" not in str(exc).lower():
                        raise
                    logger.warning(
                        "SQLite locked while streaming run %s for repo %s; retrying",
                        run_id,
                        repo_id,
                    )
                    await asyncio.sleep(0.2)
                    continue

                payload = _to_progress_payload(task, elapsed_seconds=monotonic() - started)
                if payload != last_payload:
                    yield f"event: progress\ndata: {json.dumps(payload)}\n\n"
                    last_payload = payload

                if payload["state"] in {"completed", "failed", "not_found"}:
                    break
                await asyncio.sleep(1.0)
            else:
                timeout_payload = {
                    "state": "failed",
                    "stage": "timeout",
                    "progress": 0.0,
                    "processed_commits": 0,
                    "total_commits": 0,
                    "entity_count": 0,
                    "relationship_count": 0,
                    "elapsed_seconds": int(monotonic() - started),
                    "error": "Progress stream timeout",
                }
                yield f"event: progress\ndata: {json.dumps(timeout_payload)}\n\n"
        finally:
            storage.close()

    return StreamingResponse(_stream(), media_type="text/event-stream")
