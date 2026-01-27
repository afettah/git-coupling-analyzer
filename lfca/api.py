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
                "pair_count": e["pair_count"]
            }
            for e in edges_data
        ]
        
        return {"nodes": nodes, "edges": edges, "focus_id": focus_id}
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
                snapshots.append({
                    "id": f.stem,
                    "name": data.get("name", f.stem),
                    "algorithm": data.get("result", {}).get("algorithm", "unknown"),
                    "created_at": datetime.datetime.fromtimestamp(f.stat().st_mtime).isoformat()
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
            "result": request.result
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
