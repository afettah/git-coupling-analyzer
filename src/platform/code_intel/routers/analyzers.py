from __future__ import annotations

from pathlib import Path
from typing import List

import uuid
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel

from code_intel.config import RepoPaths, DEFAULT_DATA_DIR
from code_intel.orchestrator import orchestrator
from code_intel.registry import registry
from code_intel.storage import Storage

router = APIRouter(prefix="/repos/{repo_id}/analyzers", tags=["analyzers"])

class AnalyzerInfo(BaseModel):
    type: str
    name: str
    description: str = ""
    available: bool = True
    last_run: str | None = None
    status: str | None = None
    config_schema: dict = {}

class AnalysisRequest(BaseModel):
    analyzer_type: str
    config: dict = {}
    data_dir: str = Query(default=None)

@router.get("", response_model=List[AnalyzerInfo])
def list_analyzers(repo_id: str, data_dir: str = Query(default=None)) -> List[AnalyzerInfo]:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    """List available analyzers."""
    # Get last run info for each analyzer
    last_runs: dict[str, dict] = {}
    try:
        paths = RepoPaths(Path(data_dir), repo_id)
        storage = Storage(paths.db_path, paths.parquet_dir)
        try:
            rows = storage.conn.execute(
                """
                SELECT analyzer_type, state, finished_at
                FROM analysis_tasks
                ORDER BY created_at DESC
                """
            ).fetchall()
            for r in rows:
                atype = r[0]
                if atype not in last_runs:
                    last_runs[atype] = {"state": r[1], "finished_at": r[2]}
        except Exception:
            pass
        finally:
            storage.close()
    except Exception:
        pass

    descriptions = {
        "git": "Analyzes git history for co-change coupling, hotspots, and authorship patterns",
        "deps": "Analyzes import/dependency relationships between source files",
        "semantic": "Analyzes code semantics and identifies domain boundaries",
        "intelligence": "Cross-analyzer intelligence combining git, deps, and semantic signals",
    }

    return [
        AnalyzerInfo(
            type=a["type"],
            name=a["display_name"],
            description=descriptions.get(a["type"], ""),
            available=True,
            last_run=last_runs.get(a["type"], {}).get("finished_at"),
            status=last_runs.get(a["type"], {}).get("state"),
            config_schema=a["config_schema"],
        )
        for a in registry.list_all()
    ]

@router.post("/run")
async def run_analyzer(
    repo_id: str,
    request: AnalysisRequest,
    background_tasks: BackgroundTasks
):
    """Run a specific analyzer on a repository."""
    if request.analyzer_type == "git":
        raise HTTPException(
            status_code=410,
            detail="Git analysis run endpoint moved to /repos/{repo_id}/analysis/run",
        )

    analyzer = registry.get_analyzer(request.analyzer_type)
    validation_errors = analyzer.validate_config(request.config)
    if validation_errors:
        raise HTTPException(status_code=422, detail={"errors": validation_errors})

    # Find repo source path
    paths = RepoPaths(Path(request.data_dir), repo_id)
    storage = Storage(paths.db_path, paths.parquet_dir)
    try:
        row = storage.conn.execute(
            "SELECT value FROM repo_meta WHERE key = 'source_path'"
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Repo source path not found")
        repo_path = Path(row[0])
    finally:
        storage.close()

    task_id = uuid.uuid4().hex[:12]

    # Dispatch to orchestrator
    def _run_job():
        orchestrator.run_analysis(
            analyzer_type=request.analyzer_type,
            repo_id=repo_id,
            repo_path=repo_path,
            db_path=paths.db_path,
            parquet_dir=paths.parquet_dir,
            config=request.config,
            task_id=task_id
        )

    background_tasks.add_task(_run_job)
    return {"task_id": task_id, "status": "queued"}

@router.get("/tasks")
async def list_tasks(
    repo_id: str,
    data_dir: str = Query(default=None),
    status: str | None = None,
    limit: int = 50,
):
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    """List all analysis tasks for a repository."""
    paths = RepoPaths(Path(data_dir), repo_id)
    storage = Storage(paths.db_path, paths.parquet_dir)
    try:
        where = "WHERE 1=1"
        params: list = []
        if status:
            where += " AND state = ?"
            params.append(status)
        rows = storage.conn.execute(
            f"""
            SELECT task_id, analyzer_type, state, started_at, finished_at, error
            FROM analysis_tasks
            {where}
            ORDER BY started_at DESC
            LIMIT ?
            """,
            params + [limit],
        ).fetchall()
        return [
            {
                "task_id": r[0],
                "analyzer_type": r[1],
                "state": r[2],
                "started_at": r[3],
                "finished_at": r[4],
                "error": r[5],
            }
            for r in rows
        ]
    except Exception:
        return []
    finally:
        storage.close()


@router.get("/tasks/{task_id}")
async def get_task_status(
    repo_id: str,
    task_id: str,
    data_dir: str = Query(default=None)
):
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    """Get status of a specific task."""
    paths = RepoPaths(Path(data_dir), repo_id)
    storage = Storage(paths.db_path, paths.parquet_dir)
    try:
        task = storage.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return task
    finally:
        storage.close()


@router.get("/{analyzer_type}/status")
async def get_analyzer_status(
    repo_id: str,
    analyzer_type: str,
    data_dir: str = Query(default=None),
):
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    """Get the status of a specific analyzer for a repo (latest run)."""
    paths = RepoPaths(Path(data_dir), repo_id)
    storage = Storage(paths.db_path, paths.parquet_dir)
    try:
        row = storage.conn.execute(
            """
            SELECT task_id, state, started_at, finished_at, error
            FROM analysis_tasks
            WHERE analyzer_type = ?
            ORDER BY started_at DESC
            LIMIT 1
            """,
            (analyzer_type,),
        ).fetchone()
        if not row:
            return {"analyzer_type": analyzer_type, "state": "not_run", "last_run": None}
        return {
            "analyzer_type": analyzer_type,
            "task_id": row[0],
            "state": row[1],
            "started_at": row[2],
            "finished_at": row[3],
            "error": row[4],
        }
    except Exception:
        return {"analyzer_type": analyzer_type, "state": "not_run", "last_run": None}
    finally:
        storage.close()
