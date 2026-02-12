from __future__ import annotations

import datetime
import shutil
from pathlib import Path
from typing import List

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from code_intel.config import RepoPaths, DEFAULT_DATA_DIR
from code_intel.logging_utils import get_logger
from code_intel.storage import Storage
from git_analyzer.scanner import ProjectScanner

logger = get_logger(__name__)
router = APIRouter(prefix="/repos", tags=["repos"])


class ScanSummary(BaseModel):
    scan_id: str
    total_files: int
    total_dirs: int
    commit_count: int
    languages: dict[str, int]
    frameworks: list[str]
    first_commit_date: str | None = None
    last_commit_date: str | None = None


class ScanStatusResponse(BaseModel):
    repo_id: str
    state: str
    scan: ScanSummary | None = None
    error: str | None = None


class RepoInfo(BaseModel):
    id: str
    name: str
    path: str = ""
    state: str
    file_count: int = 0
    commit_count: int = 0
    last_analyzed: str | None = None
    validation_issues: int = 0
    has_errors: bool = False
    scan: ScanSummary | None = None


class CreateRepoRequest(BaseModel):
    path: str
    name: str | None = None
    data_dir: str | None = None


class GitRemoteInfoResponse(BaseModel):
    git_remote_url: str | None = None
    git_web_url: str | None = None
    git_provider: str | None = None
    git_default_branch: str = "main"


class UpdateGitInfoRequest(BaseModel):
    git_web_url: str | None = None
    git_provider: str | None = None
    git_default_branch: str | None = None


def get_storage(repo_id: str, data_dir: str | None = None) -> Storage:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    paths = RepoPaths(Path(data_dir), repo_id)
    return Storage(paths.db_path, paths.parquet_dir)


def _summary_from_scan(scan: dict | None) -> ScanSummary | None:
    if not scan:
        return None
    return ScanSummary(
        scan_id=scan["scan_id"],
        total_files=int(scan.get("total_files", 0)),
        total_dirs=int(scan.get("total_dirs", 0)),
        commit_count=int(scan.get("commit_count", scan.get("total_commits", 0))),
        languages=scan.get("languages", {}) or {},
        frameworks=scan.get("frameworks", []) or [],
        first_commit_date=scan.get("first_commit_date"),
        last_commit_date=scan.get("last_commit_date"),
    )


def _store_git_remote_info(storage: Storage, repo_path: Path) -> None:
    """Detect and persist git remote metadata for a repository."""
    try:
        from git_analyzer.git import get_git_remote_info

        info = get_git_remote_info(repo_path)
    except Exception as exc:
        logger.warning(f"Failed to detect git remote info for {repo_path}: {exc}")
        return

    if info.remote_url is not None:
        storage.conn.execute(
            "INSERT OR REPLACE INTO repo_meta (key, value) VALUES ('git_remote_url', ?)",
            (info.remote_url,),
        )
    if info.web_url is not None:
        storage.conn.execute(
            "INSERT OR REPLACE INTO repo_meta (key, value) VALUES ('git_web_url', ?)",
            (info.web_url,),
        )
    if info.provider is not None:
        storage.conn.execute(
            "INSERT OR REPLACE INTO repo_meta (key, value) VALUES ('git_provider', ?)",
            (info.provider,),
        )
    if info.default_branch:
        storage.conn.execute(
            "INSERT OR REPLACE INTO repo_meta (key, value) VALUES ('git_default_branch', ?)",
            (info.default_branch,),
        )


def _run_scan(repo_id: str, storage: Storage, source_path: Path) -> ScanSummary:
    scanner = ProjectScanner(source_path)
    result = scanner.scan(repo_id=repo_id, storage=storage)
    return ScanSummary(
        scan_id=result.scan_id,
        total_files=result.total_files,
        total_dirs=result.total_dirs,
        commit_count=result.commit_count,
        languages=result.languages,
        frameworks=result.frameworks,
        first_commit_date=result.first_commit_date,
        last_commit_date=result.last_commit_date,
    )


def _load_source_path(storage: Storage) -> Path:
    row = storage.conn.execute(
        "SELECT value FROM repo_meta WHERE key = 'source_path'"
    ).fetchone()
    if not row or not row[0]:
        raise HTTPException(status_code=404, detail="Repo source path not found")
    path = Path(str(row[0]))
    if not path.exists():
        raise HTTPException(status_code=404, detail="Repository path does not exist on disk")
    return path


@router.get("", response_model=List[RepoInfo])
def list_repositories(data_dir: str = Query(default=None)) -> List[RepoInfo]:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    repos_base = Path(data_dir) / "repos"
    if not repos_base.exists():
        return []

    results = []
    for repo_dir in repos_base.iterdir():
        if not repo_dir.is_dir():
            continue

        repo_id = repo_dir.name
        try:
            storage = get_storage(repo_id, data_dir)
            try:
                name_row = storage.conn.execute(
                    "SELECT value FROM repo_meta WHERE key = 'name'"
                ).fetchone()
                name = name_row[0] if name_row and name_row[0] else repo_id

                source_row = storage.conn.execute(
                    "SELECT value FROM repo_meta WHERE key = 'source_path'"
                ).fetchone()
                source_path = source_row[0] if source_row else ""

                scan = storage.get_latest_project_scan(repo_id=repo_id)
                latest_task = storage.get_latest_task("git")
                latest_completed = storage.conn.execute(
                    """
                    SELECT task_id, state, finished_at
                    FROM analysis_tasks
                    WHERE analyzer_type = 'git' AND state = 'completed'
                    ORDER BY created_at DESC
                    LIMIT 1
                    """
                ).fetchone()

                state = latest_task["state"] if latest_task else ("ready" if scan else "not_started")
                if latest_task and latest_task.get("state") == "failed" and latest_completed is None:
                    state = "ready" if scan else "not_started"

                last_analyzed = None
                if latest_completed and latest_completed[2]:
                    last_analyzed = latest_completed[2]

                validation_issues = 0
                if latest_task and latest_task.get("metrics"):
                    validation_issues = int(latest_task["metrics"].get("validation_issues", 0) or 0)

                results.append(
                    RepoInfo(
                        id=repo_id,
                        name=name,
                        path=source_path,
                        state=state,
                        file_count=int(scan.get("total_files", 0) if scan else 0),
                        commit_count=int(scan.get("commit_count", 0) if scan else 0),
                        last_analyzed=last_analyzed,
                        validation_issues=validation_issues,
                        has_errors=bool(
                            latest_task
                            and latest_task.get("error")
                            and latest_task.get("state") == "failed"
                            and latest_completed is not None
                        ),
                        scan=_summary_from_scan(scan),
                    )
                )
            finally:
                storage.close()
        except Exception as exc:
            logger.warning(f"Could not read repo {repo_id}: {exc}")
            results.append(RepoInfo(id=repo_id, name=repo_id, state="error"))

    return results


@router.post("", response_model=RepoInfo)
def create_repository(request: CreateRepoRequest) -> RepoInfo:
    repo_path = Path(request.path).resolve()
    if not repo_path.exists():
        raise HTTPException(status_code=400, detail=f"Path does not exist: {request.path}")

    git_dir = repo_path / ".git"
    if not git_dir.exists() and not (repo_path / "HEAD").exists():
        raise HTTPException(status_code=400, detail=f"Not a git repository: {request.path}")

    # Use provided data_dir or fall back to DEFAULT_DATA_DIR
    data_dir_str = request.data_dir if request.data_dir is not None else str(DEFAULT_DATA_DIR)

    repo_name = (request.name or repo_path.name or "unknown").strip()
    # Generate repo_id with hash suffix to prevent collisions (ISSUE 015)
    base_id = "".join(c if c.isalnum() else "_" for c in repo_name.lower()).strip("_") or "repo"
    import hashlib
    path_hash = hashlib.md5(str(repo_path).encode()).hexdigest()[:8]
    repo_id = f"{base_id}_{path_hash}"

    paths = RepoPaths(Path(data_dir_str), repo_id)
    paths.ensure_dirs()

    storage = get_storage(repo_id, data_dir_str)
    try:
        storage.conn.execute(
            "INSERT OR REPLACE INTO repo_meta (key, value) VALUES ('repo_id', ?)",
            (repo_id,),
        )
        storage.conn.execute(
            "INSERT OR REPLACE INTO repo_meta (key, value) VALUES ('source_path', ?)",
            (str(repo_path),),
        )
        storage.conn.execute(
            "INSERT OR REPLACE INTO repo_meta (key, value) VALUES ('name', ?)",
            (repo_name,),
        )

        _store_git_remote_info(storage, repo_path)
        # Scanner opens explicit write transactions; finalize setup writes first.
        storage.conn.commit()

        scan_summary = _run_scan(repo_id=repo_id, storage=storage, source_path=repo_path)
        storage.conn.commit()

        return RepoInfo(
            id=repo_id,
            name=repo_name,
            path=str(repo_path),
            state="ready",
            file_count=scan_summary.total_files,
            commit_count=scan_summary.commit_count,
            scan=scan_summary,
        )
    except Exception as exc:
        logger.exception("Failed to create repository")
        raise HTTPException(status_code=500, detail=f"Failed to create repository: {exc}") from exc
    finally:
        storage.close()


@router.post("/{repo_id}/scan", response_model=ScanStatusResponse)
def rescan_repository(repo_id: str, data_dir: str = Query(default=None)) -> ScanStatusResponse:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = get_storage(repo_id, data_dir)
    try:
        source_path = _load_source_path(storage)
        scan = _run_scan(repo_id=repo_id, storage=storage, source_path=source_path)
        return ScanStatusResponse(repo_id=repo_id, state="ready", scan=scan)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Repository scan failed")
        return ScanStatusResponse(repo_id=repo_id, state="error", error=str(exc))
    finally:
        storage.close()


@router.get("/{repo_id}/scan", response_model=ScanStatusResponse)
def get_repository_scan(repo_id: str, data_dir: str = Query(default=None)) -> ScanStatusResponse:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = get_storage(repo_id, data_dir)
    try:
        scan = storage.get_latest_project_scan(repo_id=repo_id)
        if not scan:
            return ScanStatusResponse(repo_id=repo_id, state="not_started", scan=None)
        return ScanStatusResponse(repo_id=repo_id, state="ready", scan=_summary_from_scan(scan))
    finally:
        storage.close()


@router.delete("/{repo_id}")
def delete_repository(repo_id: str, data_dir: str = Query(default=None)) -> dict:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    """Delete a repository by moving it to a deleted folder."""
    repos_base = Path(data_dir) / "repos"
    repo_dir = repos_base / repo_id

    if not repo_dir.exists():
        raise HTTPException(status_code=404, detail=f"Repository not found: {repo_id}")

    deleted_base = Path(data_dir) / "deleted"
    deleted_base.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    deleted_name = f"{repo_id}_{timestamp}"
    deleted_path = deleted_base / deleted_name

    shutil.move(str(repo_dir), str(deleted_path))

    logger.info(f"Repository {repo_id} moved to {deleted_path}")
    return {"status": "deleted", "repo_id": repo_id}


@router.get("/{repo_id}/git-info", response_model=GitRemoteInfoResponse)
def get_git_info(repo_id: str, data_dir: str = Query(default=None)) -> GitRemoteInfoResponse:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    """Get git remote information for a repository."""
    storage = get_storage(repo_id, data_dir)
    try:
        rows = storage.conn.execute(
            """
            SELECT key, value FROM repo_meta
            WHERE key IN ('git_remote_url', 'git_web_url', 'git_provider', 'git_default_branch')
            """
        ).fetchall()
        meta = {r[0]: r[1] for r in rows}

        if not meta.get("git_web_url"):
            source_path = _load_source_path(storage)
            _store_git_remote_info(storage, source_path)
            storage.conn.commit()
            rows = storage.conn.execute(
                """
                SELECT key, value FROM repo_meta
                WHERE key IN ('git_remote_url', 'git_web_url', 'git_provider', 'git_default_branch')
                """
            ).fetchall()
            meta = {r[0]: r[1] for r in rows}

        return GitRemoteInfoResponse(
            git_remote_url=meta.get("git_remote_url"),
            git_web_url=meta.get("git_web_url"),
            git_provider=meta.get("git_provider"),
            git_default_branch=meta.get("git_default_branch", "main"),
        )
    finally:
        storage.close()


@router.put("/{repo_id}/git-info")
def update_git_info(repo_id: str, request: UpdateGitInfoRequest, data_dir: str = Query(default=None)) -> dict:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    """Manually update git remote information."""
    storage = get_storage(repo_id, data_dir)
    try:
        if request.git_web_url is not None:
            storage.conn.execute(
                "INSERT OR REPLACE INTO repo_meta (key, value) VALUES ('git_web_url', ?)",
                (request.git_web_url,),
            )
        if request.git_provider is not None:
            storage.conn.execute(
                "INSERT OR REPLACE INTO repo_meta (key, value) VALUES ('git_provider', ?)",
                (request.git_provider,),
            )
        if request.git_default_branch is not None:
            storage.conn.execute(
                "INSERT OR REPLACE INTO repo_meta (key, value) VALUES ('git_default_branch', ?)",
                (request.git_default_branch,),
            )
        storage.conn.commit()
        return {"status": "updated"}
    finally:
        storage.close()
