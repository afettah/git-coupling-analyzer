from __future__ import annotations

import datetime
import json
import shutil
from pathlib import Path
from typing import List

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from code_intel.config import RepoPaths
from code_intel.storage import Storage
from code_intel.logging_utils import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/repos", tags=["repos"])


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


class CreateRepoRequest(BaseModel):
    path: str
    name: str | None = None
    data_dir: str = "data"


class GitRemoteInfoResponse(BaseModel):
    git_remote_url: str | None = None
    git_web_url: str | None = None
    git_provider: str | None = None
    git_default_branch: str = "main"


class UpdateGitInfoRequest(BaseModel):
    git_web_url: str | None = None
    git_provider: str | None = None
    git_default_branch: str | None = None


def get_storage(repo_id: str, data_dir: str = "data") -> Storage:
    paths = RepoPaths(Path(data_dir), repo_id)
    return Storage(paths.db_path, paths.parquet_dir)


@router.get("", response_model=List[RepoInfo])
def list_repositories(data_dir: str = "data") -> List[RepoInfo]:
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
                # Get latest task info
                row = storage.conn.execute("""
                    SELECT state, entity_count, relationship_count, metrics_json, error
                    FROM analysis_tasks
                    ORDER BY created_at DESC LIMIT 1
                """).fetchone()
                
                state = row[0] if row else "not_started"
                commit_count = 0 # Mapping commit_count from metrics if needed
                file_count = row[1] or 0 if row else 0
                validation_issues = 0
                has_errors = bool(row[4]) if row and len(row) > 4 else False
                
                if row and row[3]:
                    metrics = json.loads(row[3])
                    commit_count = metrics.get("commit_count", 0)
                    validation_issues = metrics.get("validation_issues", 0)
                
                # Get source path from repo_meta
                source_path = ""
                path_row = storage.conn.execute(
                    "SELECT value FROM repo_meta WHERE key = 'source_path'"
                ).fetchone()
                if path_row:
                    source_path = path_row[0]

                # Get last_analyzed from latest completed task
                last_analyzed = None
                la_row = storage.conn.execute(
                    "SELECT finished_at FROM analysis_tasks WHERE state = 'completed' ORDER BY finished_at DESC LIMIT 1"
                ).fetchone()
                if la_row and la_row[0]:
                    last_analyzed = la_row[0]

                results.append(RepoInfo(
                    id=repo_id,
                    name=repo_id,
                    path=source_path,
                    state=state,
                    commit_count=commit_count,
                    file_count=file_count,
                    last_analyzed=last_analyzed,
                    validation_issues=validation_issues,
                    has_errors=has_errors
                ))
            finally:
                storage.close()
        except Exception as e:
            logger.warning(f"Could not read repo {repo_id}: {e}")
            results.append(RepoInfo(
                id=repo_id,
                name=repo_id,
                state="error"
            ))
    
    return results


@router.post("", response_model=RepoInfo)
def create_repository(request: CreateRepoRequest) -> RepoInfo:
    repo_path = Path(request.path)
    if not repo_path.exists():
        raise HTTPException(status_code=400, detail=f"Path does not exist: {request.path}")
    
    # Check if it's a git repository
    git_dir = repo_path / ".git"
    if not git_dir.exists() and not (repo_path / "HEAD").exists():
        raise HTTPException(status_code=400, detail=f"Not a git repository: {request.path}")
    
    repo_name = request.name or repo_path.name or "unknown"
    repo_id = "".join(c if c.isalnum() else "_" for c in repo_name.lower())
    
    paths = RepoPaths(Path(request.data_dir), repo_id)
    paths.ensure_dirs()
    
    # Initialize storage and save original repo path
    storage = get_storage(repo_id, request.data_dir)
    storage.conn.execute(
        "INSERT OR REPLACE INTO repo_meta (key, value) VALUES ('source_path', ?)",
        (str(repo_path.resolve()),)
    )
    storage.conn.execute(
        "INSERT OR REPLACE INTO repo_meta (key, value) VALUES ('name', ?)",
        (repo_name,)
    )
    
    # Detect and store git remote info
    # Note: We need to import from git_analyzer if it's available, but for now we'll assume it's a separate step or moved
    # Actually, we can't easily import from git_analyzer here if we want to keep platform independent of analyzers at import time.
    # However, for repo creation, we might need some git helper.
    # Let's see if we can move get_git_remote_info to a more shared place or keep it in git_analyzer and call it via registry if needed.
    # For now, I'll keep it simple.
    
    storage.conn.commit()
    storage.close()
    
    return RepoInfo(id=repo_id, name=repo_name, state="not_started")


@router.delete("/{repo_id}")
def delete_repository(repo_id: str, data_dir: str = "data") -> dict:
    """Delete a repository by moving it to a deleted folder."""
    repos_base = Path(data_dir) / "repos"
    repo_dir = repos_base / repo_id
    
    if not repo_dir.exists():
        raise HTTPException(status_code=404, detail=f"Repository not found: {repo_id}")
    
    # Create deleted folder
    deleted_base = Path(data_dir) / "deleted"
    deleted_base.mkdir(parents=True, exist_ok=True)
    
    # Generate unique name with timestamp
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    deleted_name = f"{repo_id}_{timestamp}"
    deleted_path = deleted_base / deleted_name
    
    # Move to deleted folder
    shutil.move(str(repo_dir), str(deleted_path))
    
    logger.info(f"Repository {repo_id} moved to {deleted_path}")
    return {"status": "deleted", "repo_id": repo_id}


@router.get("/{repo_id}/git-info", response_model=GitRemoteInfoResponse)
def get_git_info(repo_id: str, data_dir: str = "data") -> GitRemoteInfoResponse:
    """Get git remote information for a repository."""
    storage = get_storage(repo_id, data_dir)
    try:
        # Get stored values from repo_meta
        rows = storage.conn.execute("""
            SELECT key, value FROM repo_meta 
            WHERE key IN ('git_remote_url', 'git_web_url', 'git_provider', 'git_default_branch')
        """).fetchall()
        
        meta = {r[0]: r[1] for r in rows}
        
        return GitRemoteInfoResponse(
            git_remote_url=meta.get('git_remote_url'),
            git_web_url=meta.get('git_web_url'),
            git_provider=meta.get('git_provider'),
            git_default_branch=meta.get('git_default_branch', 'main')
        )
    finally:
        storage.close()


@router.put("/{repo_id}/git-info")
def update_git_info(repo_id: str, request: UpdateGitInfoRequest, data_dir: str = "data") -> dict:
    """Manually update git remote information."""
    storage = get_storage(repo_id, data_dir)
    try:
        if request.git_web_url is not None:
            storage.conn.execute(
                "INSERT OR REPLACE INTO repo_meta (key, value) VALUES ('git_web_url', ?)",
                (request.git_web_url,)
            )
        if request.git_provider is not None:
            storage.conn.execute(
                "INSERT OR REPLACE INTO repo_meta (key, value) VALUES ('git_provider', ?)",
                (request.git_provider,)
            )
        if request.git_default_branch is not None:
            storage.conn.execute(
                "INSERT OR REPLACE INTO repo_meta (key, value) VALUES ('git_default_branch', ?)",
                (request.git_default_branch,)
            )
        storage.conn.commit()
        return {"status": "updated"}
    finally:
        storage.close()
