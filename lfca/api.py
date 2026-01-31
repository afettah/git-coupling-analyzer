"""FastAPI application."""

from __future__ import annotations

import datetime
import json
from pathlib import Path
from typing import List

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import pyarrow.dataset as ds

from lfca.config import RepoPaths, CouplingConfig
from lfca.storage import Storage
from lfca.sync import build_file_tree, get_folder_list
from lfca.clustering.insights import calculate_cluster_insights, compare_clusters
from lfca.logging_utils import get_logger

logger = get_logger(__name__)

app = FastAPI(title="LFCA API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_STATIC_DIR = Path(__file__).resolve().parent / "static"
if _STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static")


def get_storage(repo_id: str, data_dir: str = "data") -> Storage:
    paths = RepoPaths(Path(data_dir), repo_id)
    return Storage(paths.db_path, paths.parquet_dir)


def _paths(repo_id: str, data_dir: str) -> RepoPaths:
    return RepoPaths(Path(data_dir), repo_id)


# === Models ===

class ApiErrorDetail(BaseModel):
    code: str
    message: str
    details: dict | list | str | None = None


class ApiError(BaseModel):
    error: ApiErrorDetail


class RepoInfo(BaseModel):
    id: str
    name: str
    state: str
    file_count: int = 0
    commit_count: int = 0


class FileInfo(BaseModel):
    file_id: int
    path: str
    exists_at_head: bool
    total_commits: int


class CoupledFile(BaseModel):
    file_id: int
    path: str
    pair_count: float
    jaccard: float
    jaccard_weighted: float
    p_dst_given_src: float
    p_src_given_dst: float


class FileHistory(BaseModel):
    file_id: int
    path: str
    commits: List[dict]
    renames: List[dict]


class AnalysisRequest(BaseModel):
    repo_path: str | None = None
    min_revisions: int = 5
    max_changeset_size: int = 50
    changeset_mode: str = "by_commit"
    author_time_window_hours: int = 24
    ticket_id_pattern: str | None = None
    min_cooccurrence: int = 5
    window_days: int | None = None
    since: str | None = None
    until: str | None = None
    data_dir: str = "data"


class ClusterRequest(BaseModel):
    algorithm: str = "louvain"
    weight_column: str = "jaccard"
    min_weight: float = 0.1
    folders: List[str] = Field(default_factory=list)
    params: dict = Field(default_factory=dict)
    data_dir: str = "data"


class CreateRepoRequest(BaseModel):
    path: str
    name: str | None = None
    data_dir: str = "data"


# === Exception Handlers ===

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail,
                "details": None
            }
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Validation error",
                "details": exc.errors()
            }
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error occurred")
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
                "details": str(exc) if app.debug else None
            }
        },
    )


# === Endpoints ===

@app.get("/")
def index() -> FileResponse:
    if not _STATIC_DIR.exists():
        raise HTTPException(status_code=404, detail="Static frontend not found")
    return FileResponse(_STATIC_DIR / "index.html")


@app.get("/repos", response_model=List[RepoInfo])
def list_repositories(data_dir: str = "data") -> List[RepoInfo]:
    repos_base = Path(data_dir) / "repos"
    if not repos_base.exists():
        return []
    
    results = []
    for repo_dir in repos_base.iterdir():
        if not repo_dir.is_dir():
            continue
        
        repo_id = repo_dir.name
        storage = get_storage(repo_id, data_dir)
        
        try:
            # Get latest run info
            row = storage.conn.execute("""
                SELECT state, commit_count, file_count FROM analysis_runs
                ORDER BY created_at DESC LIMIT 1
            """).fetchone()
            
            state = row[0] if row else "not_started"
            commit_count = row[1] or 0 if row else 0
            file_count = row[2] or 0 if row else 0
            
            results.append(RepoInfo(
                id=repo_id,
                name=repo_id,
                state=state,
                commit_count=commit_count,
                file_count=file_count
            ))
        finally:
            storage.close()
    
    return results


@app.delete("/repos/{repo_id}")
def delete_repository(repo_id: str, data_dir: str = "data") -> dict:
    """Delete a repository by moving it to a deleted folder."""
    import shutil
    
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


@app.post("/repos", response_model=RepoInfo)
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
    
    paths = _paths(repo_id, request.data_dir)
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
    storage.conn.commit()
    storage.close()
    
    return RepoInfo(id=repo_id, name=repo_name, state="not_started")


# --- Repository Structure ---

@app.get("/repos/{repo_id}/files/tree")
def get_file_tree(repo_id: str, data_dir: str = "data") -> dict:
    """Get current file tree (only files at HEAD)."""
    storage = get_storage(repo_id, data_dir)
    try:
        return build_file_tree(storage)
    finally:
        storage.close()


@app.get("/repos/{repo_id}/files", response_model=List[FileInfo])
def list_files(
    repo_id: str,
    q: str | None = None,
    current_only: bool = True,
    limit: int = 500,
    sort_by: str = "path",
    sort_dir: str = "asc",
    data_dir: str = "data"
) -> List[FileInfo]:
    """List files, optionally filtered by path prefix."""
    storage = get_storage(repo_id, data_dir)
    try:
        if sort_by not in {"path", "commits"}:
            raise HTTPException(status_code=400, detail="sort_by must be 'path' or 'commits'")
        if sort_dir.lower() not in {"asc", "desc"}:
            raise HTTPException(status_code=400, detail="sort_dir must be 'asc' or 'desc'")

        if current_only:
            query = """
                SELECT file_id, path_current, exists_at_head, total_commits
                FROM files
                WHERE exists_at_head = TRUE
            """
        else:
            query = """
                SELECT file_id, COALESCE(path_current, path_latest), exists_at_head, total_commits
                FROM files
            """
        
        params = []
        if q:
            query += " AND path_current LIKE ?"
            params.append(f"{q}%")

        sort_key = "path_current" if sort_by == "path" else "total_commits"
        direction = "DESC" if sort_dir.lower() == "desc" else "ASC"

        query += f" ORDER BY {sort_key} {direction} LIMIT {limit}"
        
        rows = storage.conn.execute(query, params).fetchall()
        return [
            FileInfo(file_id=r[0], path=r[1] or "", exists_at_head=bool(r[2]), total_commits=r[3] or 0)
            for r in rows
        ]
    finally:
        storage.close()


@app.get("/repos/{repo_id}/folders")
def list_folders(
    repo_id: str,
    depth: int = 2,
    data_dir: str = "data"
) -> List[str]:
    """Get folder list at given depth."""
    storage = get_storage(repo_id, data_dir)
    try:
        return get_folder_list(storage, depth)
    finally:
        storage.close()


# --- File History ---

@app.get("/repos/{repo_id}/files/{path:path}/history")
def get_file_history(
    repo_id: str,
    path: str,
    limit: int = 100,
    data_dir: str = "data"
) -> FileHistory:
    """Get commit history for a file."""
    storage = get_storage(repo_id, data_dir)
    try:
        file_info = storage.get_file_by_path(path)
        if not file_info:
            raise HTTPException(404, f"File not found: {path}")
        
        file_id = file_info["file_id"]
        
        # Get commits from changes parquet
        changes_path = storage.parquet_dir / "changes.parquet"
        
        if changes_path.exists():
            dataset = ds.dataset(changes_path)
            table = dataset.to_table(filter=ds.field("file_id") == file_id)
            commits = table.to_pylist()[:limit]
        else:
            commits = []
        
        # Get renames
        renames = storage.conn.execute("""
            SELECT path, start_commit_oid, end_commit_oid
            FROM file_lineage
            WHERE file_id = ?
            ORDER BY start_commit_oid
        """, (file_id,)).fetchall()
        
        return FileHistory(
            file_id=file_id,
            path=path,
            commits=commits,
            renames=[{"path": r[0], "start": r[1], "end": r[2]} for r in renames]
        )
    finally:
        storage.close()


# --- File Details ---

class FileDetails(BaseModel):
    file_id: int
    path: str
    exists_at_head: bool
    total_commits: int
    first_commit_date: str | None = None
    last_commit_date: str | None = None
    total_lines_added: int = 0
    total_lines_deleted: int = 0
    authors_count: int = 0
    top_author: str | None = None
    coupled_files_count: int = 0
    max_coupling: float = 0.0
    strong_coupling_count: int = 0
    commits_last_30_days: int = 0
    churn_rate: float = 0.0
    risk_score: int = 0


class FileActivityData(BaseModel):
    commits_by_period: List[dict]
    lines_by_period: List[dict]
    authors_by_period: List[dict]
    heatmap_data: List[dict]
    day_hour_matrix: List[dict]


class FileAuthorsData(BaseModel):
    authors: List[dict]
    ownership_timeline: List[dict]


class FileCommitsData(BaseModel):
    commits: List[dict]
    total_count: int


class FolderDetails(BaseModel):
    path: str
    file_count: int
    subfolder_count: int
    total_commits: int
    total_lines_added: int
    total_lines_deleted: int
    authors_count: int
    top_author: str | None = None
    health_score: int = 0
    hot_files: List[dict]


@app.get("/repos/{repo_id}/files/{path:path}/details", response_model=FileDetails)
def get_file_details(
    repo_id: str,
    path: str,
    data_dir: str = "data"
) -> FileDetails:
    """Get comprehensive file details including stats, coupling, and activity metrics."""
    storage = get_storage(repo_id, data_dir)
    try:
        file_info = storage.get_file_by_path(path)
        if not file_info:
            raise HTTPException(404, f"File not found: {path}")
        
        file_id = file_info["file_id"]
        
        # Get coupling stats
        coupling_row = storage.conn.execute("""
            SELECT 
                COUNT(*) as coupled_count,
                MAX(jaccard) as max_coupling,
                SUM(CASE WHEN jaccard > 0.5 THEN 1 ELSE 0 END) as strong_coupling_count
            FROM (
                SELECT jaccard FROM edges WHERE src_file_id = ?
                UNION ALL
                SELECT jaccard FROM edges WHERE dst_file_id = ?
            )
        """, (file_id, file_id)).fetchone()
        
        coupled_count = coupling_row[0] if coupling_row else 0
        max_coupling = coupling_row[1] if coupling_row and coupling_row[1] else 0.0
        strong_coupling_count = coupling_row[2] if coupling_row and coupling_row[2] else 0
        
        # Get activity stats from parquet
        changes_path = storage.parquet_dir / "changes.parquet"
        commits_path = storage.parquet_dir / "commits.parquet"
        
        total_lines_added = 0
        total_lines_deleted = 0
        authors = set()
        author_commit_counts = {}
        first_commit_date = None
        last_commit_date = None
        commits_last_30_days = 0
        
        if changes_path.exists() and commits_path.exists():
            try:
                changes_ds = ds.dataset(changes_path)
                commits_ds = ds.dataset(commits_path)
                
                changes_table = changes_ds.to_table(filter=ds.field("file_id") == file_id)
                commits_table = commits_ds.to_table()
                
                commits_lookup = {c["commit_oid"]: c for c in commits_table.to_pylist()}
                changes = changes_table.to_pylist()
                
                from datetime import datetime, timedelta
                now = datetime.now()
                thirty_days_ago = now - timedelta(days=30)
                
                commit_dates = []
                
                for change in changes:
                    total_lines_added += change.get("lines_added", 0) or 0
                    total_lines_deleted += change.get("lines_deleted", 0) or 0
                    
                    commit_info = commits_lookup.get(change.get("commit_oid"), {})
                    author = commit_info.get("author_name", "Unknown")
                    authors.add(author)
                    author_commit_counts[author] = author_commit_counts.get(author, 0) + 1
                    
                    commit_ts = change.get("commit_ts") or commit_info.get("authored_ts")
                    if commit_ts:
                        ts = commit_ts.as_py() if hasattr(commit_ts, 'as_py') else commit_ts
                        if isinstance(ts, datetime):
                            commit_dates.append(ts)
                            if ts > thirty_days_ago:
                                commits_last_30_days += 1
                
                if commit_dates:
                    first_commit_date = min(commit_dates).isoformat()
                    last_commit_date = max(commit_dates).isoformat()
                
            except Exception as e:
                logger.warning(f"Error reading parquet for file details: {e}")
        
        # Calculate top author
        top_author = None
        if author_commit_counts:
            top_author = max(author_commit_counts, key=author_commit_counts.get)
        
        # Calculate churn rate (changes per week over the lifetime)
        total_commits = file_info.get("total_commits", 0) or 0
        churn_rate = 0.0
        if first_commit_date and last_commit_date:
            from datetime import datetime
            first_dt = datetime.fromisoformat(first_commit_date)
            last_dt = datetime.fromisoformat(last_commit_date)
            weeks = max(1, (last_dt - first_dt).days / 7)
            churn_rate = round(total_commits / weeks, 2)
        
        # Calculate risk score (0-100)
        risk_score = 0
        if total_commits > 50:
            risk_score += 20
        elif total_commits > 20:
            risk_score += 10
        
        if len(authors) > 5:
            risk_score += 20
        elif len(authors) > 3:
            risk_score += 10
        
        if max_coupling > 0.7:
            risk_score += 20
        elif max_coupling > 0.5:
            risk_score += 10
        
        if commits_last_30_days > 10:
            risk_score += 20
        elif commits_last_30_days > 5:
            risk_score += 10
        
        if strong_coupling_count > 3:
            risk_score += 20
        elif strong_coupling_count > 1:
            risk_score += 10
        
        return FileDetails(
            file_id=file_id,
            path=path,
            exists_at_head=file_info.get("exists_at_head", True),
            total_commits=total_commits,
            first_commit_date=first_commit_date,
            last_commit_date=last_commit_date,
            total_lines_added=total_lines_added,
            total_lines_deleted=total_lines_deleted,
            authors_count=len(authors),
            top_author=top_author,
            coupled_files_count=coupled_count,
            max_coupling=round(max_coupling, 3),
            strong_coupling_count=strong_coupling_count,
            commits_last_30_days=commits_last_30_days,
            churn_rate=churn_rate,
            risk_score=min(100, risk_score)
        )
    finally:
        storage.close()


@app.get("/repos/{repo_id}/files/{path:path}/activity")
def get_file_activity(
    repo_id: str,
    path: str,
    granularity: str = "monthly",
    data_dir: str = "data"
) -> dict:
    """Get file activity data for charts."""
    storage = get_storage(repo_id, data_dir)
    try:
        file_info = storage.get_file_by_path(path)
        if not file_info:
            raise HTTPException(404, f"File not found: {path}")
        
        file_id = file_info["file_id"]
        
        changes_path = storage.parquet_dir / "changes.parquet"
        commits_path = storage.parquet_dir / "commits.parquet"
        
        commits_by_period = []
        lines_by_period = []
        authors_by_period = []
        heatmap_data = []
        day_hour_matrix = [[0] * 24 for _ in range(7)]
        
        if changes_path.exists() and commits_path.exists():
            try:
                from datetime import datetime
                from collections import defaultdict
                
                changes_ds = ds.dataset(changes_path)
                commits_ds = ds.dataset(commits_path)
                
                changes_table = changes_ds.to_table(filter=ds.field("file_id") == file_id)
                commits_table = commits_ds.to_table()
                
                commits_lookup = {c["commit_oid"]: c for c in commits_table.to_pylist()}
                changes = changes_table.to_pylist()
                
                period_commits = defaultdict(int)
                period_lines_added = defaultdict(int)
                period_lines_deleted = defaultdict(int)
                period_authors = defaultdict(set)
                daily_commits = defaultdict(int)
                
                for change in changes:
                    commit_info = commits_lookup.get(change.get("commit_oid"), {})
                    commit_ts = change.get("commit_ts") or commit_info.get("authored_ts")
                    author = commit_info.get("author_name", "Unknown")
                    
                    if commit_ts:
                        ts = commit_ts.as_py() if hasattr(commit_ts, 'as_py') else commit_ts
                        if isinstance(ts, datetime):
                            # Period key based on granularity
                            if granularity == "daily":
                                period_key = ts.strftime("%Y-%m-%d")
                            elif granularity == "weekly":
                                period_key = ts.strftime("%Y-W%W")
                            elif granularity == "quarterly":
                                quarter = (ts.month - 1) // 3 + 1
                                period_key = f"{ts.year}-Q{quarter}"
                            else:  # monthly
                                period_key = ts.strftime("%Y-%m")
                            
                            period_commits[period_key] += 1
                            period_lines_added[period_key] += change.get("lines_added", 0) or 0
                            period_lines_deleted[period_key] += change.get("lines_deleted", 0) or 0
                            period_authors[period_key].add(author)
                            
                            # Daily commits for heatmap
                            day_key = ts.strftime("%Y-%m-%d")
                            daily_commits[day_key] += 1
                            
                            # Day/hour matrix
                            day_of_week = ts.weekday()
                            hour = ts.hour
                            day_hour_matrix[day_of_week][hour] += 1
                
                # Sort periods
                sorted_periods = sorted(period_commits.keys())
                
                commits_by_period = [
                    {"period": p, "count": period_commits[p]}
                    for p in sorted_periods
                ]
                
                lines_by_period = [
                    {"period": p, "added": period_lines_added[p], "deleted": period_lines_deleted[p]}
                    for p in sorted_periods
                ]
                
                authors_by_period = [
                    {"period": p, "count": len(period_authors[p])}
                    for p in sorted_periods
                ]
                
                # Heatmap data
                heatmap_data = [
                    {"date": date, "count": count}
                    for date, count in sorted(daily_commits.items())
                ]
                
            except Exception as e:
                logger.warning(f"Error reading parquet for file activity: {e}")
        
        return {
            "commits_by_period": commits_by_period,
            "lines_by_period": lines_by_period,
            "authors_by_period": authors_by_period,
            "heatmap_data": heatmap_data,
            "day_hour_matrix": [
                {"day": day, "hours": hours}
                for day, hours in enumerate(day_hour_matrix)
            ]
        }
    finally:
        storage.close()


@app.get("/repos/{repo_id}/files/{path:path}/authors")
def get_file_authors(
    repo_id: str,
    path: str,
    data_dir: str = "data"
) -> dict:
    """Get file author statistics."""
    storage = get_storage(repo_id, data_dir)
    try:
        file_info = storage.get_file_by_path(path)
        if not file_info:
            raise HTTPException(404, f"File not found: {path}")
        
        file_id = file_info["file_id"]
        
        changes_path = storage.parquet_dir / "changes.parquet"
        commits_path = storage.parquet_dir / "commits.parquet"
        
        authors = []
        ownership_timeline = []
        
        if changes_path.exists() and commits_path.exists():
            try:
                from datetime import datetime
                from collections import defaultdict
                
                changes_ds = ds.dataset(changes_path)
                commits_ds = ds.dataset(commits_path)
                
                changes_table = changes_ds.to_table(filter=ds.field("file_id") == file_id)
                commits_table = commits_ds.to_table()
                
                commits_lookup = {c["commit_oid"]: c for c in commits_table.to_pylist()}
                changes = changes_table.to_pylist()
                
                author_stats = defaultdict(lambda: {
                    "commits": 0,
                    "lines_added": 0,
                    "lines_deleted": 0,
                    "first_commit": None,
                    "last_commit": None
                })
                
                author_timeline = defaultdict(lambda: defaultdict(int))
                
                for change in changes:
                    commit_info = commits_lookup.get(change.get("commit_oid"), {})
                    author = commit_info.get("author_name", "Unknown")
                    commit_ts = change.get("commit_ts") or commit_info.get("authored_ts")
                    
                    stats = author_stats[author]
                    stats["commits"] += 1
                    stats["lines_added"] += change.get("lines_added", 0) or 0
                    stats["lines_deleted"] += change.get("lines_deleted", 0) or 0
                    
                    if commit_ts:
                        ts = commit_ts.as_py() if hasattr(commit_ts, 'as_py') else commit_ts
                        if isinstance(ts, datetime):
                            if stats["first_commit"] is None or ts < stats["first_commit"]:
                                stats["first_commit"] = ts
                            if stats["last_commit"] is None or ts > stats["last_commit"]:
                                stats["last_commit"] = ts
                            
                            # Monthly timeline
                            month_key = ts.strftime("%Y-%m")
                            author_timeline[month_key][author] += 1
                
                # Calculate total commits for percentage
                total_commits = sum(s["commits"] for s in author_stats.values())
                
                # Build authors list
                authors = [
                    {
                        "name": name,
                        "commits": stats["commits"],
                        "percentage": round(stats["commits"] / total_commits * 100, 1) if total_commits else 0,
                        "lines_added": stats["lines_added"],
                        "lines_deleted": stats["lines_deleted"],
                        "first_commit": stats["first_commit"].isoformat() if stats["first_commit"] else None,
                        "last_commit": stats["last_commit"].isoformat() if stats["last_commit"] else None
                    }
                    for name, stats in author_stats.items()
                ]
                
                # Sort by commits desc
                authors.sort(key=lambda x: x["commits"], reverse=True)
                
                # Build ownership timeline
                for month in sorted(author_timeline.keys()):
                    month_data = {"month": month, "authors": []}
                    for author, count in author_timeline[month].items():
                        month_data["authors"].append({"name": author, "commits": count})
                    ownership_timeline.append(month_data)
                
            except Exception as e:
                logger.warning(f"Error reading parquet for file authors: {e}")
        
        return {
            "authors": authors,
            "ownership_timeline": ownership_timeline
        }
    finally:
        storage.close()


@app.get("/repos/{repo_id}/files/{path:path}/commits")
def get_file_commits(
    repo_id: str,
    path: str,
    search: str | None = None,
    exclude_merges: bool = False,
    limit: int = 50,
    offset: int = 0,
    data_dir: str = "data"
) -> dict:
    """Get file commit history with search and filtering."""
    storage = get_storage(repo_id, data_dir)
    try:
        file_info = storage.get_file_by_path(path)
        if not file_info:
            raise HTTPException(404, f"File not found: {path}")
        
        file_id = file_info["file_id"]
        
        changes_path = storage.parquet_dir / "changes.parquet"
        commits_path = storage.parquet_dir / "commits.parquet"
        
        commits = []
        total_count = 0
        
        if changes_path.exists() and commits_path.exists():
            try:
                from datetime import datetime
                
                changes_ds = ds.dataset(changes_path)
                commits_ds = ds.dataset(commits_path)
                
                changes_table = changes_ds.to_table(filter=ds.field("file_id") == file_id)
                commits_table = commits_ds.to_table()
                
                commits_lookup = {c["commit_oid"]: c for c in commits_table.to_pylist()}
                changes = changes_table.to_pylist()
                
                commit_list = []
                seen_oids = set()
                
                for change in changes:
                    oid = change.get("commit_oid")
                    if oid in seen_oids:
                        continue
                    seen_oids.add(oid)
                    
                    commit_info = commits_lookup.get(oid, {})
                    message = commit_info.get("message_subject", "")
                    author = commit_info.get("author_name", "Unknown")
                    
                    # Filter merges
                    if exclude_merges and message.lower().startswith("merge"):
                        continue
                    
                    # Search filter
                    if search:
                        search_lower = search.lower()
                        if (search_lower not in message.lower() and 
                            search_lower not in author.lower() and
                            search_lower not in oid.lower()):
                            continue
                    
                    commit_ts = change.get("commit_ts") or commit_info.get("authored_ts")
                    ts_str = None
                    if commit_ts:
                        ts = commit_ts.as_py() if hasattr(commit_ts, 'as_py') else commit_ts
                        if isinstance(ts, datetime):
                            ts_str = ts.isoformat()
                    
                    commit_list.append({
                        "oid": oid,
                        "message": message,
                        "author": author,
                        "date": ts_str,
                        "lines_added": change.get("lines_added", 0) or 0,
                        "lines_deleted": change.get("lines_deleted", 0) or 0
                    })
                
                # Sort by date desc
                commit_list.sort(key=lambda x: x["date"] or "", reverse=True)
                
                total_count = len(commit_list)
                commits = commit_list[offset:offset + limit]
                
            except Exception as e:
                logger.warning(f"Error reading parquet for file commits: {e}")
        
        return {
            "commits": commits,
            "total_count": total_count
        }
    finally:
        storage.close()


@app.get("/repos/{repo_id}/folders/{path:path}/details")
def get_folder_details(
    repo_id: str,
    path: str,
    data_dir: str = "data"
) -> dict:
    """Get folder-level aggregated statistics."""
    storage = get_storage(repo_id, data_dir)
    try:
        # Get all files in this folder
        folder_prefix = f"{path}/%"
        rows = storage.conn.execute("""
            SELECT file_id, path_current, total_commits
            FROM files
            WHERE exists_at_head = TRUE 
              AND (path_current LIKE ? OR path_current = ?)
            ORDER BY total_commits DESC
        """, (folder_prefix, path)).fetchall()
        
        if not rows:
            raise HTTPException(404, f"Folder not found or empty: {path}")
        
        file_ids = [r[0] for r in rows]
        file_count = len(rows)
        total_commits = sum(r[2] or 0 for r in rows)
        
        # Count subfolders
        subfolder_set = set()
        path_prefix_len = len(path) + 1  # +1 for the slash
        for r in rows:
            file_path = r[1]
            if file_path and file_path.startswith(path + "/"):
                relative = file_path[path_prefix_len:]
                if "/" in relative:
                    subfolder = relative.split("/")[0]
                    subfolder_set.add(subfolder)
        
        # Get author and line stats from parquet
        changes_path = storage.parquet_dir / "changes.parquet"
        commits_path = storage.parquet_dir / "commits.parquet"
        
        total_lines_added = 0
        total_lines_deleted = 0
        authors = set()
        author_commit_counts = {}
        
        if changes_path.exists() and commits_path.exists():
            try:
                changes_ds = ds.dataset(changes_path)
                commits_ds = ds.dataset(commits_path)
                
                # Filter changes by file_ids
                changes_table = changes_ds.to_table(filter=ds.field("file_id").isin(file_ids))
                commits_table = commits_ds.to_table()
                
                commits_lookup = {c["commit_oid"]: c for c in commits_table.to_pylist()}
                changes = changes_table.to_pylist()
                
                for change in changes:
                    total_lines_added += change.get("lines_added", 0) or 0
                    total_lines_deleted += change.get("lines_deleted", 0) or 0
                    
                    commit_info = commits_lookup.get(change.get("commit_oid"), {})
                    author = commit_info.get("author_name", "Unknown")
                    authors.add(author)
                    author_commit_counts[author] = author_commit_counts.get(author, 0) + 1
                    
            except Exception as e:
                logger.warning(f"Error reading parquet for folder details: {e}")
        
        # Top author
        top_author = None
        if author_commit_counts:
            top_author = max(author_commit_counts, key=author_commit_counts.get)
        
        # Calculate health score based on various metrics
        health_score = 80  # Base score
        
        # Penalize for too many files
        if file_count > 50:
            health_score -= 10
        elif file_count > 20:
            health_score -= 5
        
        # Penalize for high churn
        if total_commits > 500:
            health_score -= 15
        elif total_commits > 200:
            health_score -= 10
        
        # Penalize for many authors (potential ownership issues)
        if len(authors) > 10:
            health_score -= 10
        
        health_score = max(0, min(100, health_score))
        
        # Hot files (top 10 by commits)
        hot_files = [
            {"path": r[1], "commits": r[2] or 0}
            for r in rows[:10]
        ]
        
        return {
            "path": path,
            "file_count": file_count,
            "subfolder_count": len(subfolder_set),
            "total_commits": total_commits,
            "total_lines_added": total_lines_added,
            "total_lines_deleted": total_lines_deleted,
            "authors_count": len(authors),
            "top_author": top_author,
            "health_score": health_score,
            "hot_files": hot_files
        }
    finally:
        storage.close()


# --- Global Coupling ---

@app.get("/repos/{repo_id}/coupling", response_model=List[CoupledFile])
def get_coupling(
    repo_id: str,
    path: str,
    metric: str = "jaccard",
    min_weight: float = 0.0,
    limit: int = 50,
    current_only: bool = True,
    data_dir: str = "data"
) -> List[CoupledFile]:
    """Get globally coupled files based on pre-computed edges."""
    storage = get_storage(repo_id, data_dir)
    try:
        file_info = storage.get_file_by_path(path)
        if not file_info:
            raise HTTPException(404, f"File not found: {path}")
        
        edges = storage.get_edges_for_file(
            file_info["file_id"],
            metric=metric,
            min_weight=min_weight,
            limit=limit,
            current_only=current_only
        )
        
        return [CoupledFile(**e) for e in edges]
    finally:
        storage.close()


@app.get("/repos/{repo_id}/coupling/graph")
def get_coupling_graph(
    repo_id: str,
    path: str,
    metric: str = "jaccard",
    min_weight: float = 0.1,
    limit: int = 30,
    data_dir: str = "data"
) -> dict:
    """Get coupling as graph (nodes + edges) for visualization."""
    storage = get_storage(repo_id, data_dir)
    try:
        file_info = storage.get_file_by_path(path)
        if not file_info:
            raise HTTPException(404, f"File not found: {path}")
        
        focus_id = file_info["file_id"]
        edges_data = storage.get_edges_for_file(focus_id, metric=metric, min_weight=min_weight, limit=limit)
        
        # Build nodes
        node_ids = {focus_id}
        for e in edges_data:
            node_ids.add(e["file_id"])
        
        # Get paths
        placeholders = ",".join("?" * len(node_ids))
        rows = storage.conn.execute(f"""
            SELECT file_id, path_current FROM files WHERE file_id IN ({placeholders})
        """, list(node_ids)).fetchall()
        path_map = {r[0]: r[1] for r in rows}
        
        nodes = [
            {"id": nid, "path": path_map.get(nid, f"file:{nid}"), "is_focus": nid == focus_id}
            for nid in node_ids
        ]
        
        edges = [
            {
                "source": focus_id,
                "target": e["file_id"],
                "weight": e[metric],
                "pair_count": e["pair_count"],
                "src_count": e.get("src_count", 0),  # These might need to be added to get_edges_for_file
                "dst_count": e.get("dst_count", 0),
                "jaccard": e.get("jaccard", 0),
                "jaccard_weighted": e.get("jaccard_weighted", 0),
                "p_dst_given_src": e.get("p_dst_given_src", 0),
                "p_src_given_dst": e.get("p_src_given_dst", 0),
            }
            for e in edges_data
        ]
        
        return {"nodes": nodes, "edges": edges, "focus_id": focus_id}
    finally:
        storage.close()


# --- Evidence ---

@app.get("/repos/{repo_id}/coupling/evidence")
def get_edge_evidence(
    repo_id: str,
    src_id: int,
    dst_id: int,
    limit: int = 20,
    data_dir: str = "data"
) -> dict:
    """Get commit-level evidence for a coupling edge."""
    storage = get_storage(repo_id, data_dir)
    try:
        # 1. Get file paths for context
        rows = storage.conn.execute("""
            SELECT file_id, path_current FROM files WHERE file_id IN (?, ?)
        """, (src_id, dst_id)).fetchall()
        path_map = {r[0]: r[1] for r in rows}
        
        # 2. Find common commits from changes.parquet
        changes_path = storage.parquet_dir / "changes.parquet"
        if not changes_path.exists():
            return {"commits": []}
            
        dataset = ds.dataset(changes_path)
        
        # Get commits for src
        src_table = dataset.to_table(
            filter=ds.field("file_id") == src_id,
            columns=["commit_oid"]
        )
        src_oids = {d["commit_oid"] for d in src_table.to_pylist()}
        
        # Get commits for dst
        dst_table = dataset.to_table(
            filter=ds.field("file_id") == dst_id,
            columns=["commit_oid"]
        )
        dst_oids = {d["commit_oid"] for d in dst_table.to_pylist()}
        
        # Common OIDs
        common_oids = src_oids & dst_oids
        
        if not common_oids:
            return {"commits": [], "src_path": path_map.get(src_id), "dst_path": path_map.get(dst_id)}
            
        # 3. Get commit details from commits.parquet
        commits_path = storage.parquet_dir / "commits.parquet"
        if not commits_path.exists():
             return {"commits": [{"oid": oid} for oid in list(common_oids)[:limit]]}
             
        commits_dataset = ds.dataset(commits_path)
        # Convert to list for filtering
        oid_list = list(common_oids)
        
        # Filter commits. We use a scanner or to_table with filter
        # pyarrow filter 'in' is supported in newer versions
        commit_table = commits_dataset.to_table(
            filter=ds.field("commit_oid").isin(oid_list[:100]), # Limit OIDs to avoid huge filter
            columns=["commit_oid", "message_subject", "author_name", "authored_ts"]
        )
        
        commits = commit_table.to_pylist()
        # Sort by timestamp desc
        commits.sort(key=lambda x: x["authored_ts"], reverse=True)
        
        return {
            "src_id": src_id,
            "src_path": path_map.get(src_id),
            "dst_id": dst_id,
            "dst_path": path_map.get(dst_id),
            "commits": commits[:limit]
        }
    finally:
        storage.close()


# --- Component Level Coupling ---

@app.get("/repos/{repo_id}/coupling/components")
def get_component_coupling(
    repo_id: str,
    component: str,
    depth: int = 2,
    limit: int = 20,
    data_dir: str = "data"
) -> dict:
    """Get coupling at component/folder level."""
    storage = get_storage(repo_id, data_dir)
    try:
        rows = storage.conn.execute("""
            SELECT dst_component, pair_count, jaccard, file_pair_count
            FROM component_edges
            WHERE src_component = ? AND depth = ?
            ORDER BY jaccard DESC
            LIMIT ?
        """, (component, depth, limit)).fetchall()
        
        return {
            "component": component,
            "depth": depth,
            "coupled_components": [
                {"component": r[0], "pair_count": r[1], "jaccard": r[2], "file_pair_count": r[3]}
                for r in rows
            ]
        }
    finally:
        storage.close()


# --- Analysis ---

def _run_analysis_job(repo_id: str, request: AnalysisRequest) -> None:
    from lfca.runner import create_run, run_analysis
    from lfca.mirror import mirror_repo
    
    paths = _paths(repo_id, request.data_dir)
    
    config = CouplingConfig(
        min_revisions=request.min_revisions,
        max_changeset_size=request.max_changeset_size,
        changeset_mode=request.changeset_mode,
        author_time_window_hours=request.author_time_window_hours,
        ticket_id_pattern=request.ticket_id_pattern,
        min_cooccurrence=request.min_cooccurrence,
        window_days=request.window_days,
    )
    
    run_id = create_run(paths, config)
    
    # Get source path from request or database
    if request.repo_path:
        repo_path = Path(request.repo_path)
    else:
        storage = get_storage(repo_id, request.data_dir)
        try:
            row = storage.conn.execute(
                "SELECT value FROM repo_meta WHERE key = 'source_path'"
            ).fetchone()
            if row:
                repo_path = Path(row[0])
            else:
                raise ValueError(f"No source path found for repository {repo_id}")
        finally:
            storage.close()
    
    run_analysis(
        paths=paths,
        run_id=run_id,
        repo_path=repo_path,
        config=config,
        since=request.since,
        until=request.until
    )


@app.post("/repos/{repo_id}/analysis/start")
def start_analysis(repo_id: str, request: AnalysisRequest, background_tasks: BackgroundTasks) -> dict:
    paths = _paths(repo_id, request.data_dir)
    paths.ensure_dirs()
    background_tasks.add_task(_run_analysis_job, repo_id, request)
    return {"state": "queued"}


@app.get("/repos/{repo_id}/analysis/status")
def analysis_status(repo_id: str, data_dir: str = "data") -> dict:
    from lfca.runner import get_latest_run
    paths = _paths(repo_id, data_dir)
    run = get_latest_run(paths)
    if not run:
        return {"state": "not_started"}
    return run


# --- Clustering ---

class SaveSnapshotRequest(BaseModel):
    name: str
    result: dict
    tags: List[str] | None = None
    data_dir: str = "data"


class UpdateSnapshotRequest(BaseModel):
    name: str | None = None
    tags: List[str] | None = None
    data_dir: str = "data"


@app.get("/repos/{repo_id}/clustering/algorithms")
def list_clustering_algorithms(repo_id: str) -> list[dict]:
    """List available clustering algorithms with their parameters."""
    from lfca.clustering import list_algorithms
    return list_algorithms()


@app.post("/repos/{repo_id}/clustering/run")
def run_clustering(repo_id: str, request: ClusterRequest) -> dict:
    """Run clustering algorithm."""
    from lfca.clustering import get_algorithm
    
    storage = get_storage(repo_id, request.data_dir)
    try:
        # Get edges
        if request.folders:
            folder_patterns = [f"{f}/%" for f in request.folders]
            placeholders = " OR ".join(["path_current LIKE ?" for _ in folder_patterns])
            rows = storage.conn.execute(f"""
                SELECT file_id, path_current FROM files
                WHERE exists_at_head = TRUE AND ({placeholders})
            """, folder_patterns).fetchall()
        else:
            rows = storage.conn.execute("""
                SELECT file_id, path_current FROM files WHERE exists_at_head = TRUE
            """).fetchall()
        
        file_ids = {r[0] for r in rows}
        file_paths = {r[0]: r[1] for r in rows}
        
        if not file_ids:
            return {"algorithm": request.algorithm, "cluster_count": 0, "clusters": [], "metrics": {}}
        
        # Get all edges between these files
        placeholders = ",".join("?" * len(file_ids))
        edges = storage.conn.execute(f"""
            SELECT src_file_id, dst_file_id, pair_count, jaccard, jaccard_weighted,
                   p_dst_given_src, p_src_given_dst
            FROM edges
            WHERE src_file_id IN ({placeholders}) AND dst_file_id IN ({placeholders})
        """, list(file_ids) + list(file_ids)).fetchall()
        
        edges_list = [
            {
                "src_file_id": e[0], "dst_file_id": e[1], "pair_count": e[2],
                "jaccard": e[3], "jaccard_weighted": e[4],
                "p_dst_given_src": e[5], "p_src_given_dst": e[6]
            }
            for e in edges
        ]
        
        # Run algorithm
        algo = get_algorithm(request.algorithm)
        result = algo.run(
            edges_list,
            file_ids,
            file_paths,
            {**request.params, "weight_column": request.weight_column, "min_weight": request.min_weight}
        )
        
        # Calculate insights
        result = calculate_cluster_insights(storage, result, edges=edges_list)
        
        return result.to_dict()
    finally:
        storage.close()


@app.get("/repos/{repo_id}/clustering/snapshots")
def list_snapshots(repo_id: str, data_dir: str = "data") -> list[dict]:
    """List available clustering snapshots."""
    paths = _paths(repo_id, data_dir)
    if not paths.snapshots_dir.exists():
        return []
    
    snapshots = []
    for f in paths.snapshots_dir.glob("*.json"):
        try:
            with open(f, "r") as f_in:
                data = json.load(f_in)
                result = data.get("result", {}) or {}
                clusters = result.get("clusters", []) or []
                cluster_count = result.get("cluster_count") or len(clusters)
                file_count = 0
                avg_coupling = 0.0
                if clusters:
                    for cluster in clusters:
                        files = cluster.get("files") or []
                        file_count += len(files) or cluster.get("size", 0)
                        avg_coupling += cluster.get("avg_coupling", 0.0)
                    avg_coupling = avg_coupling / len(clusters)
                snapshots.append({
                    "id": f.stem,
                    "name": data.get("name", f.stem),
                    "algorithm": data.get("result", {}).get("algorithm", "unknown"),
                    "created_at": datetime.datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
                    "cluster_count": cluster_count,
                    "file_count": file_count,
                    "avg_coupling": avg_coupling,
                    "tags": data.get("tags", [])
                })
        except Exception:
            logger.warning(f"Failed to read snapshot {f}")
            
    return sorted(snapshots, key=lambda x: x["created_at"], reverse=True)


@app.post("/repos/{repo_id}/clustering/snapshots")
def save_snapshot(repo_id: str, request: SaveSnapshotRequest) -> dict:
    """Save a clustering snapshot."""
    paths = _paths(repo_id, request.data_dir)
    paths.ensure_dirs()
    
    snapshot_id = "".join(c if c.isalnum() else "_" for c in request.name.lower())
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{snapshot_id}_{timestamp}.json"
    
    snapshot_path = paths.snapshots_dir / filename
    with open(snapshot_path, "w") as f_out:
        json.dump({
            "name": request.name,
            "result": request.result,
            "tags": request.tags or []
        }, f_out)
        
    return {"id": filename.replace(".json", ""), "status": "saved"}


@app.get("/repos/{repo_id}/clustering/snapshots/{snapshot_id}")
def get_snapshot(repo_id: str, snapshot_id: str, data_dir: str = "data") -> dict:
    """Load a clustering snapshot."""
    paths = _paths(repo_id, data_dir)
    snapshot_path = paths.snapshots_dir / f"{snapshot_id}.json"
    
    if not snapshot_path.exists():
        raise HTTPException(status_code=404, detail="Snapshot not found")
        
    with open(snapshot_path, "r") as f_in:
        return json.load(f_in)


@app.put("/repos/{repo_id}/clustering/snapshots/{snapshot_id}")
def update_snapshot(repo_id: str, snapshot_id: str, request: UpdateSnapshotRequest) -> dict:
    paths = _paths(repo_id, request.data_dir)
    snapshot_path = paths.snapshots_dir / f"{snapshot_id}.json"

    if not snapshot_path.exists():
        raise HTTPException(status_code=404, detail="Snapshot not found")

    with open(snapshot_path, "r") as f_in:
        data = json.load(f_in)

    if request.name is not None:
        data["name"] = request.name
    if request.tags is not None:
        data["tags"] = request.tags

    with open(snapshot_path, "w") as f_out:
        json.dump(data, f_out)

    return {"status": "updated", "id": snapshot_id}


@app.delete("/repos/{repo_id}/clustering/snapshots/{snapshot_id}")
def delete_snapshot(repo_id: str, snapshot_id: str, data_dir: str = "data") -> dict:
    paths = _paths(repo_id, data_dir)
    snapshot_path = paths.snapshots_dir / f"{snapshot_id}.json"

    if not snapshot_path.exists():
        raise HTTPException(status_code=404, detail="Snapshot not found")

    snapshot_path.unlink()
    return {"status": "deleted", "id": snapshot_id}


@app.get("/repos/{repo_id}/clustering/snapshots/{snapshot_id}/edges")
def snapshot_edges(repo_id: str, snapshot_id: str, limit: int = 50, data_dir: str = "data") -> dict:
    paths = _paths(repo_id, data_dir)
    snapshot_path = paths.snapshots_dir / f"{snapshot_id}.json"

    if not snapshot_path.exists():
        raise HTTPException(status_code=404, detail="Snapshot not found")

    with open(snapshot_path, "r") as f_in:
        data = json.load(f_in)

    clusters = data.get("result", {}).get("clusters", []) or []
    if not clusters:
        return {"edges": []}

    file_to_cluster = {}
    file_ids = []
    for cluster in clusters:
        cluster_id = cluster.get("id")
        for fid in cluster.get("file_ids", []):
            file_to_cluster[fid] = cluster_id
            file_ids.append(fid)

    if not file_ids:
        return {"edges": []}

    storage = get_storage(repo_id, data_dir)
    try:
        placeholders = ",".join("?" * len(file_ids))
        rows = storage.conn.execute(f"""
            SELECT src_file_id, dst_file_id, jaccard
            FROM edges
            WHERE src_file_id IN ({placeholders}) AND dst_file_id IN ({placeholders})
        """, file_ids + file_ids).fetchall()

        aggregates = {}
        for src_id, dst_id, weight in rows:
            src_cluster = file_to_cluster.get(src_id)
            dst_cluster = file_to_cluster.get(dst_id)
            if src_cluster is None or dst_cluster is None or src_cluster == dst_cluster:
                continue
            key = tuple(sorted((src_cluster, dst_cluster)))
            if key not in aggregates:
                aggregates[key] = {"sum": 0.0, "count": 0}
            aggregates[key]["sum"] += weight
            aggregates[key]["count"] += 1

        edges = [
            {
                "from_cluster": key[0],
                "to_cluster": key[1],
                "coupling_strength": (value["sum"] / value["count"]) if value["count"] else 0.0
            }
            for key, value in aggregates.items()
        ]

        edges.sort(key=lambda e: e["coupling_strength"], reverse=True)
        return {"edges": edges[:limit]}
    finally:
        storage.close()


@app.get("/repos/{repo_id}/clustering/compare")
def compare_snapshots_endpoint(
    repo_id: str,
    base: str,
    head: str,
    data_dir: str = "data"
) -> dict:
    """Compare two clustering snapshots."""
    paths = _paths(repo_id, data_dir)
    
    base_path = paths.snapshots_dir / f"{base}.json"
    head_path = paths.snapshots_dir / f"{head}.json"
    
    if not base_path.exists() or not head_path.exists():
        raise HTTPException(status_code=404, detail="One or both snapshots not found")
        
    with open(base_path, "r") as f1, open(head_path, "r") as f2:
        base_data = json.load(f1)
        head_data = json.load(f2)
        
    return compare_clusters(base_data['result'], head_data['result'])


# Legacy endpoint compatibility
@app.get("/repos/{repo_id}/impact")
def impact(repo_id: str, path: str, top: int = 20, data_dir: str = "data") -> List[dict]:
    """Legacy impact endpoint - returns coupled files."""
    storage = get_storage(repo_id, data_dir)
    try:
        file_info = storage.get_file_by_path(path)
        if not file_info:
            raise HTTPException(404, f"File not found: {path}")
        
        edges = storage.get_edges_for_file(file_info["file_id"], limit=top)
        return edges
    finally:
        storage.close()


@app.get("/repos/{repo_id}/impact/graph")
def impact_graph(repo_id: str, path: str, top: int = 20, data_dir: str = "data") -> dict:
    """Legacy graph endpoint."""
    return get_coupling_graph(repo_id, path, limit=top, data_dir=data_dir)
