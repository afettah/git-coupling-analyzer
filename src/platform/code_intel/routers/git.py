from __future__ import annotations

from pathlib import Path
from typing import List

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from code_intel.config import RepoPaths
from code_intel.registry import registry
from code_intel.storage import Storage
from code_intel.logging_utils import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/repos/{repo_id}/git", tags=["git"])


def _paths(repo_id: str, data_dir: str) -> RepoPaths:
    return RepoPaths(Path(data_dir), repo_id)


def _storage(repo_id: str, data_dir: str) -> Storage:
    paths = _paths(repo_id, data_dir)
    return Storage(paths.db_path, paths.parquet_dir)


# ── Coupling ─────────────────────────────────────────────────────────────────

@router.get("/coupling")
async def get_file_coupling(
    repo_id: str,
    path: str,
    metric: str = "jaccard",
    min_weight: float = 0.0,
    limit: int = 50,
    data_dir: str = "data",
):
    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()
    return api.get_file_coupling(
        paths.db_path, path, metric=metric, min_weight=min_weight, limit=limit
    )


@router.get("/graph")
async def get_coupling_graph(
    repo_id: str,
    root_path: str = "",
    metric: str = "jaccard",
    min_weight: float = 0.1,
    limit: int = 200,
    data_dir: str = "data",
):
    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()
    return api.get_coupling_graph(
        paths.db_path, root_path, metric=metric, min_weight=min_weight, limit=limit
    )


@router.get("/coupling/components")
async def get_component_coupling(
    repo_id: str,
    component: str = "",
    depth: int = 2,
    data_dir: str = "data",
):
    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()
    return api.get_component_coupling(paths.db_path, component, depth=depth)


@router.get("/coupling/edges")
async def get_coupling_edges(
    repo_id: str,
    limit: int = 500,
    min_weight: float = 0.0,
    metric: str = "jaccard",
    offset: int = 0,
    data_dir: str = "data",
):
    """Return raw coupling edges for export / table views."""
    paths = _paths(repo_id, data_dir)
    storage = _storage(repo_id, data_dir)
    try:
        rows = storage.conn.execute(
            f"""
            SELECT e1.qualified_name AS source, e2.qualified_name AS target,
                   r.weight AS coupling, r.properties_json
            FROM relationships r
            JOIN entities e1 ON r.src_entity_id = e1.entity_id
            JOIN entities e2 ON r.dst_entity_id = e2.entity_id
            WHERE r.weight >= ? AND r.source_type = 'git'
            ORDER BY r.weight DESC
            LIMIT ? OFFSET ?
            """,
            (min_weight, limit, offset),
        ).fetchall()
        
        results = []
        for r in rows:
            props = json.loads(r[3]) if r[3] else {}
            results.append({
                "source": r[0],
                "target": r[1],
                "coupling": r[2],
                "pair_count": props.get("pair_count", 0)
            })
        return results
    finally:
        storage.close()


# ── Files & Folders ──────────────────────────────────────────────────────────

@router.get("/files")
async def list_files(
    repo_id: str,
    q: str | None = None,
    current_only: bool = True,
    limit: int = 5000,
    sort_by: str = "path",
    sort_dir: str = "asc",
    data_dir: str = "data",
):
    storage = _storage(repo_id, data_dir)
    try:
        where = "WHERE 1=1"
        params: list = []
        if current_only:
            where += " AND f.exists_at_head = 1"
        if q:
            where += " AND f.path_current LIKE ?"
            params.append(f"%{q}%")

        order = "f.path_current" if sort_by == "path" else "f.total_commits"
        direction = "ASC" if sort_dir == "asc" else "DESC"

        rows = storage.conn.execute(
            f"""
            SELECT e.entity_id, e.qualified_name AS path,
                   e.exists_at_head, e.metadata_json
            FROM entities e
            {where.replace('f.', 'e.')}
            ORDER BY e.qualified_name {direction}
            LIMIT ?
            """,
            params + [limit],
        ).fetchall()
        
        results = []
        for r in rows:
            meta = json.loads(r[3]) if r[3] else {}
            results.append({
                "file_id": r[0],
                "path": r[1],
                "exists_at_head": bool(r[2]),
                "total_commits": meta.get("total_commits", 0),
            })
        return results
    finally:
        storage.close()


@router.get("/folders")
async def list_folders(repo_id: str, depth: int | None = None, data_dir: str = "data"):
    storage = _storage(repo_id, data_dir)
    try:
        rows = storage.conn.execute(
            "SELECT DISTINCT qualified_name FROM entities WHERE exists_at_head = 1 AND kind = 'file'"
        ).fetchall()
        folders: set[str] = set()
        for (path_str,) in rows:
            if not path_str:
                continue
            parts = path_str.split("/")
            for i in range(1, len(parts)):
                folder = "/".join(parts[:i])
                if depth is None or i <= depth:
                    folders.add(folder)
        return sorted(folders)
    finally:
        storage.close()


@router.get("/tree")
async def get_file_tree(repo_id: str, data_dir: str = "data"):
    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()
    return api.get_file_tree(paths.db_path)


@router.get("/files/{path:path}/history")
async def get_file_history(repo_id: str, path: str, data_dir: str = "data"):
    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()
    return api.get_file_history(paths.db_path, paths.parquet_dir, path)


@router.get("/files/{path:path}/details")
async def get_file_details(repo_id: str, path: str, data_dir: str = "data"):
    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()
    return api.get_file_details(paths.db_path, paths.parquet_dir, path)


@router.get("/files/{path:path}/activity")
async def get_file_activity(
    repo_id: str, path: str, granularity: str = "monthly", data_dir: str = "data"
):
    """Per-file activity breakdown (commits, lines, authors over time)."""
    import pyarrow.dataset as ds

    paths = _paths(repo_id, data_dir)
    storage = _storage(repo_id, data_dir)
    try:
        row = storage.conn.execute(
            "SELECT entity_id FROM entities WHERE qualified_name = ? AND kind = 'file'", (path,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "File not found")
        file_id = row[0]

        changes_path = paths.parquet_dir / "changes.parquet"
        commits_path = paths.parquet_dir / "commits.parquet"
        if not changes_path.exists() or not commits_path.exists():
            return {"commits_by_period": [], "lines_by_period": [], "authors_by_period": [], "heatmap_data": [], "day_hour_matrix": []}

        changes = ds.dataset(changes_path).to_table(
            filter=ds.field("file_id") == file_id
        ).to_pylist()
        commits_map = {
            c["commit_oid"]: c
            for c in ds.dataset(commits_path).to_table().to_pylist()
        }

        # Simple aggregation by month
        from collections import defaultdict
        from datetime import datetime

        by_period: dict[str, dict] = defaultdict(
            lambda: {"commits": 0, "added": 0, "deleted": 0, "authors": set()}
        )
        for ch in changes:
            ci = commits_map.get(ch.get("commit_oid"), {})
            ts = ch.get("commit_ts") or ci.get("authored_ts")
            if ts is None:
                continue
            dt = ts.as_py() if hasattr(ts, "as_py") else datetime.fromtimestamp(ts) if isinstance(ts, (int, float)) else ts
            period = dt.strftime("%Y-%m") if hasattr(dt, "strftime") else str(dt)[:7]
            by_period[period]["commits"] += 1
            by_period[period]["added"] += ch.get("lines_added", 0) or 0
            by_period[period]["deleted"] += ch.get("lines_deleted", 0) or 0
            author = ci.get("author_name", "Unknown")
            by_period[period]["authors"].add(author)

        sorted_periods = sorted(by_period.keys())
        return {
            "commits_by_period": [{"period": p, "count": by_period[p]["commits"]} for p in sorted_periods],
            "lines_by_period": [{"period": p, "added": by_period[p]["added"], "deleted": by_period[p]["deleted"]} for p in sorted_periods],
            "authors_by_period": [{"period": p, "count": len(by_period[p]["authors"])} for p in sorted_periods],
            "heatmap_data": [],
            "day_hour_matrix": [],
        }
    finally:
        storage.close()


@router.get("/files/{path:path}/authors")
async def get_file_authors(repo_id: str, path: str, data_dir: str = "data"):
    """Per-file author breakdown."""
    import pyarrow.dataset as ds

    paths = _paths(repo_id, data_dir)
    storage = _storage(repo_id, data_dir)
    try:
        row = storage.conn.execute(
            "SELECT entity_id FROM entities WHERE qualified_name = ? AND kind = 'file'", (path,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "File not found")
        file_id = row[0]

        changes_path = paths.parquet_dir / "changes.parquet"
        commits_path = paths.parquet_dir / "commits.parquet"
        if not changes_path.exists() or not commits_path.exists():
            return {"authors": [], "ownership_timeline": []}

        changes = ds.dataset(changes_path).to_table(
            filter=ds.field("file_id") == file_id
        ).to_pylist()
        commits_map = {
            c["commit_oid"]: c
            for c in ds.dataset(commits_path).to_table().to_pylist()
        }

        from collections import defaultdict

        author_stats: dict[str, dict] = defaultdict(
            lambda: {"commits": 0, "lines_added": 0, "lines_deleted": 0, "first": None, "last": None}
        )
        total = len(changes)
        for ch in changes:
            ci = commits_map.get(ch.get("commit_oid"), {})
            name = ci.get("author_name", "Unknown")
            author_stats[name]["commits"] += 1
            author_stats[name]["lines_added"] += ch.get("lines_added", 0) or 0
            author_stats[name]["lines_deleted"] += ch.get("lines_deleted", 0) or 0

        authors = sorted(author_stats.items(), key=lambda x: -x[1]["commits"])
        return {
            "authors": [
                {
                    "name": name,
                    "commits": s["commits"],
                    "percentage": round(s["commits"] / total * 100, 1) if total else 0,
                    "lines_added": s["lines_added"],
                    "lines_deleted": s["lines_deleted"],
                    "first_commit": None,
                    "last_commit": None,
                }
                for name, s in authors
            ],
            "ownership_timeline": [],
        }
    finally:
        storage.close()


@router.get("/files/{path:path}/commits")
async def get_file_commits(
    repo_id: str,
    path: str,
    search: str | None = None,
    exclude_merges: bool = False,
    limit: int = 100,
    offset: int = 0,
    data_dir: str = "data",
):
    """Per-file commit list."""
    import pyarrow.dataset as ds

    paths = _paths(repo_id, data_dir)
    storage = _storage(repo_id, data_dir)
    try:
        row = storage.conn.execute(
            "SELECT entity_id FROM entities WHERE qualified_name = ? AND kind = 'file'", (path,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "File not found")
        file_id = row[0]

        changes_path = paths.parquet_dir / "changes.parquet"
        commits_path = paths.parquet_dir / "commits.parquet"
        if not changes_path.exists() or not commits_path.exists():
            return {"commits": [], "total_count": 0}

        changes = ds.dataset(changes_path).to_table(
            filter=ds.field("file_id") == file_id
        ).to_pylist()
        commits_map = {
            c["commit_oid"]: c
            for c in ds.dataset(commits_path).to_table().to_pylist()
        }

        results = []
        for ch in changes:
            ci = commits_map.get(ch.get("commit_oid"), {})
            msg = ci.get("subject", "") or ""
            if search and search.lower() not in msg.lower():
                continue
            results.append(
                {
                    "oid": ch.get("commit_oid", ""),
                    "message": msg,
                    "author": ci.get("author_name", "Unknown"),
                    "date": None,
                    "lines_added": ch.get("lines_added", 0) or 0,
                    "lines_deleted": ch.get("lines_deleted", 0) or 0,
                }
            )

        total = len(results)
        page = results[offset : offset + limit]
        return {"commits": page, "total_count": total}
    finally:
        storage.close()


@router.get("/folders/{path:path}/details")
async def get_folder_details(repo_id: str, path: str, data_dir: str = "data"):
    """Folder-level details."""
    storage = _storage(repo_id, data_dir)
    try:
        pattern = f"{path}/%"
        rows = storage.conn.execute(
            """
            SELECT COUNT(*), metadata_json
            FROM entities
            WHERE exists_at_head = 1 AND qualified_name LIKE ? AND kind = 'file'
            """,
            (pattern,),
        ).fetchall()
        
        file_count = len(rows)
        total_commits = sum(json.loads(r[1]).get("total_commits", 0) if r[1] else 0 for r in rows)

        subfolders = storage.conn.execute(
            """
            SELECT DISTINCT
                SUBSTR(qualified_name, LENGTH(?) + 1,
                       INSTR(SUBSTR(qualified_name, LENGTH(?) + 1), '/') - 1
                ) AS sub
            FROM entities
            WHERE exists_at_head = 1 AND qualified_name LIKE ? AND kind = 'file'
              AND INSTR(SUBSTR(qualified_name, LENGTH(?) + 1), '/') > 0
            """,
            (path + "/", path + "/", pattern, path + "/"),
        ).fetchall()

        return {
            "path": path,
            "file_count": file_count,
            "subfolder_count": len(subfolders),
            "total_commits": total_commits,
            "total_lines_added": 0,
            "total_lines_deleted": 0,
            "authors_count": 0,
            "top_author": None,
            "health_score": 0,
            "hot_files": [],
            "treemap_data": [],
            "churn_distribution": [],
            "coupling_stats": {
                "internal_coupling": 0,
                "external_coupling": 0,
                "cohesion_score": 0,
                "coupled_external_files": [],
            },
        }
    finally:
        storage.close()


# ── Hotspots ─────────────────────────────────────────────────────────────────

@router.get("/hotspots")
async def get_hotspots(
    repo_id: str,
    limit: int = 50,
    sort_by: str = "risk_score",
    data_dir: str = "data",
):
    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()
    return api.get_hotspots(paths.db_path, paths.parquet_dir, limit=limit, sort_by=sort_by)


# ── Clustering ───────────────────────────────────────────────────────────────

@router.get("/clustering/algorithms")
async def get_clustering_algorithms(repo_id: str, data_dir: str = "data"):
    try:
        from git_analyzer.clustering.registry import list_algorithms
        return list_algorithms()
    except ImportError:
        return []


class ClusterRequest(BaseModel):
    algorithm: str = "louvain"
    weight_column: str = "jaccard"
    min_weight: float = 0.1
    folders: list[str] = []
    params: dict = {}


@router.post("/clustering/run")
async def run_clustering(
    repo_id: str,
    request: ClusterRequest,
    data_dir: str = "data",
):
    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()
    return api.run_clustering(
        paths.db_path,
        algorithm=request.algorithm,
        weight_column=request.weight_column,
        min_weight=request.min_weight,
    )


@router.post("/clustering/snapshots")
async def save_clustering_snapshot(repo_id: str, body: dict, data_dir: str = "data"):
    import json, uuid
    storage = _storage(repo_id, data_dir)
    try:
        snap_id = uuid.uuid4().hex[:12]
        storage.conn.execute(
            """
            INSERT INTO clustering_snapshots (id, name, algorithm, result_json, tags_json, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                snap_id,
                body.get("name", "Untitled"),
                body.get("result", {}).get("algorithm", ""),
                json.dumps(body.get("result", {})),
                json.dumps(body.get("tags", [])),
            ),
        )
        storage.conn.commit()
        return {"id": snap_id, "status": "saved"}
    except Exception:
        # Table may not exist – that's OK, return empty
        return {"id": None, "status": "snapshot_table_not_available"}
    finally:
        storage.close()


@router.get("/clustering/snapshots")
async def list_clustering_snapshots(repo_id: str, data_dir: str = "data"):
    import json
    storage = _storage(repo_id, data_dir)
    try:
        rows = storage.conn.execute(
            "SELECT id, name, algorithm, created_at, result_json, tags_json FROM clustering_snapshots ORDER BY created_at DESC"
        ).fetchall()
        results = []
        for r in rows:
            result_data = json.loads(r[4]) if r[4] else {}
            results.append({
                "id": r[0],
                "name": r[1],
                "algorithm": r[2],
                "created_at": r[3],
                "cluster_count": result_data.get("cluster_count"),
                "tags": json.loads(r[5]) if r[5] else [],
            })
        return results
    except Exception:
        return []
    finally:
        storage.close()


@router.get("/clustering/snapshots/{snapshot_id}")
async def get_clustering_snapshot(repo_id: str, snapshot_id: str, data_dir: str = "data"):
    import json
    storage = _storage(repo_id, data_dir)
    try:
        row = storage.conn.execute(
            "SELECT name, result_json FROM clustering_snapshots WHERE id = ?",
            (snapshot_id,),
        ).fetchone()
        if not row:
            raise HTTPException(404, "Snapshot not found")
        return {"name": row[0], "result": json.loads(row[1]) if row[1] else {}}
    finally:
        storage.close()


@router.put("/clustering/snapshots/{snapshot_id}")
async def update_clustering_snapshot(
    repo_id: str, snapshot_id: str, body: dict, data_dir: str = "data"
):
    import json
    storage = _storage(repo_id, data_dir)
    try:
        updates = []
        params = []
        if "name" in body:
            updates.append("name = ?")
            params.append(body["name"])
        if "tags" in body:
            updates.append("tags_json = ?")
            params.append(json.dumps(body["tags"]))
        if not updates:
            return {"status": "no_changes"}
        params.append(snapshot_id)
        storage.conn.execute(
            f"UPDATE clustering_snapshots SET {', '.join(updates)} WHERE id = ?",
            params,
        )
        storage.conn.commit()
        return {"status": "updated"}
    finally:
        storage.close()


@router.delete("/clustering/snapshots/{snapshot_id}")
async def delete_clustering_snapshot(
    repo_id: str, snapshot_id: str, data_dir: str = "data"
):
    storage = _storage(repo_id, data_dir)
    try:
        storage.conn.execute(
            "DELETE FROM clustering_snapshots WHERE id = ?", (snapshot_id,)
        )
        storage.conn.commit()
        return {"status": "deleted"}
    finally:
        storage.close()


@router.get("/clustering/snapshots/{snapshot_id}/edges")
async def get_snapshot_edges(repo_id: str, snapshot_id: str, data_dir: str = "data"):
    return {"edges": []}


@router.get("/clustering/compare")
async def compare_snapshots(
    repo_id: str, base: str = "", head: str = "", data_dir: str = "data"
):
    return {
        "comparisons": [],
        "flows": [],
        "nodes": {"old": [], "new": []},
        "summary": {"stable": 0, "drifted": 0, "dissolved": 0, "new": 0},
    }


# ── Dashboard ────────────────────────────────────────────────────────────────

@router.get("/dashboard/summary")
async def get_dashboard_summary(repo_id: str, data_dir: str = "data"):
    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()
    return api.get_dashboard_summary(paths.db_path, paths.parquet_dir)


@router.get("/dashboard/trends")
async def get_dashboard_trends(
    repo_id: str, months: int = 6, granularity: str = "monthly", data_dir: str = "data"
):
    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()
    return api.get_timeline(paths.db_path, paths.parquet_dir, points=months, granularity=granularity)


# ── Authors & Timeline ───────────────────────────────────────────────────────

@router.get("/authors")
async def get_authors(repo_id: str, limit: int = 50, data_dir: str = "data"):
    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()
    return api.get_authors(paths.db_path, paths.parquet_dir, limit=limit)


@router.get("/timeline")
async def get_timeline(
    repo_id: str,
    points: int = 12,
    granularity: str = "monthly",
    data_dir: str = "data",
):
    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()
    return api.get_timeline(
        paths.db_path, paths.parquet_dir, points=points, granularity=granularity
    )
