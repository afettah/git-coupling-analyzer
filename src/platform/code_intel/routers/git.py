from __future__ import annotations

from pathlib import Path
from typing import List

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from code_intel.config import RepoPaths, DEFAULT_DATA_DIR
from code_intel.registry import registry
from code_intel.storage import Storage
from code_intel.logging_utils import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/repos/{repo_id}/git", tags=["git"])


def _paths(repo_id: str, data_dir: str | None = None) -> RepoPaths:
    """Get repository paths using global or provided data_dir."""
    if data_dir is None:
        return RepoPaths(DEFAULT_DATA_DIR, repo_id)
    return RepoPaths(Path(data_dir), repo_id)


def _storage(repo_id: str, data_dir: str | None = None) -> Storage:
    """Get storage instance for repository."""
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
    data_dir: str = Query(default=None),
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
    data_dir: str = Query(default=None),
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
    data_dir: str = Query(default=None),
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
    data_dir: str = Query(default=None),
):
    """Return raw coupling edges for export / table views."""
    # Validate metric to prevent SQL injection
    allowed_metrics = {"jaccard", "jaccard_weighted", "p_dst_given_src", "p_src_given_dst", "pair_count"}
    if metric not in allowed_metrics:
        raise HTTPException(400, f"Invalid metric: {metric}")
    
    paths = _paths(repo_id, data_dir)
    storage = _storage(repo_id, data_dir)
    try:
        rows = storage.conn.execute(
            f"""
            SELECT e1.qualified_name AS source, e2.qualified_name AS target,
                   g.{metric} AS coupling, g.pair_count
            FROM git_edges g
            JOIN entities e1 ON g.src_entity_id = e1.entity_id
            JOIN entities e2 ON g.dst_entity_id = e2.entity_id
            WHERE g.{metric} >= ?
            ORDER BY g.{metric} DESC
            LIMIT ? OFFSET ?
            """,
            (min_weight, limit, offset),
        ).fetchall()
        return [
            {"source": r[0], "target": r[1], "coupling": r[2], "pair_count": r[3]}
            for r in rows
        ]
    finally:
        storage.close()


# ── Impact & Lineage ─────────────────────────────────────────────────────────

@router.get("/impact")
async def get_file_impact(
    repo_id: str,
    path: str,
    top: int = 20,
    data_dir: str = Query(default=None),
):
    """Get the top coupled files for a given file path."""
    storage = _storage(repo_id, data_dir)
    try:
        row = storage.conn.execute(
            "SELECT entity_id FROM entities WHERE qualified_name = ? AND kind = 'file'",
            (path,),
        ).fetchone()
        if not row:
            raise HTTPException(404, "File not found")
        file_id = row[0]

        rows = storage.conn.execute(
            """
            SELECT e.entity_id, e.qualified_name AS path,
                   g.pair_count, g.jaccard, g.jaccard_weighted,
                   g.p_dst_given_src, g.p_src_given_dst
            FROM git_edges g
            JOIN entities e ON g.dst_entity_id = e.entity_id
            WHERE g.src_entity_id = ?
            UNION
            SELECT e.entity_id, e.qualified_name AS path,
                   g.pair_count, g.jaccard, g.jaccard_weighted,
                   g.p_src_given_dst, g.p_dst_given_src
            FROM git_edges g
            JOIN entities e ON g.src_entity_id = e.entity_id
            WHERE g.dst_entity_id = ?
            ORDER BY jaccard DESC
            LIMIT ?
            """,
            (file_id, file_id, top),
        ).fetchall()
        return [
            {
                "file_id": r[0],
                "path": r[1],
                "pair_count": r[2],
                "jaccard": r[3],
                "jaccard_weighted": r[4],
                "p_dst_given_src": r[5],
                "p_src_given_dst": r[6],
            }
            for r in rows
        ]
    finally:
        storage.close()


@router.get("/impact/graph")
async def get_impact_graph(
    repo_id: str,
    path: str,
    top: int = 25,
    data_dir: str = Query(default=None),
):
    """Get a graph visualization centered on a single file's coupling."""
    storage = _storage(repo_id, data_dir)
    try:
        row = storage.conn.execute(
            "SELECT entity_id, qualified_name FROM entities WHERE qualified_name = ? AND kind = 'file'",
            (path,),
        ).fetchone()
        if not row:
            raise HTTPException(404, "File not found")
        focus_id = row[0]
        focus_path = row[1]

        # Get top coupled edges for this file (both directions)
        rows = storage.conn.execute(
            """
            SELECT g.src_entity_id, g.dst_entity_id, g.jaccard
            FROM git_edges g
            WHERE g.src_entity_id = ? OR g.dst_entity_id = ?
            ORDER BY g.jaccard DESC
            LIMIT ?
            """,
            (focus_id, focus_id, top),
        ).fetchall()

        node_ids = {focus_id}
        edges = []
        for r in rows:
            node_ids.add(r[0])
            node_ids.add(r[1])
            edges.append({"source": r[0], "target": r[1], "weight": r[2]})

        # Get node details
        placeholders = ",".join("?" for _ in node_ids)
        node_rows = storage.conn.execute(
            f"SELECT entity_id, qualified_name FROM entities WHERE entity_id IN ({placeholders})",
            list(node_ids),
        ).fetchall()

        nodes = [{"id": r[0], "path": r[1]} for r in node_rows]
        return {"nodes": nodes, "edges": edges, "focus_id": focus_id}
    finally:
        storage.close()


@router.get("/files/{path:path}/lineage")
async def get_file_lineage(repo_id: str, path: str, data_dir: str = Query(default=None)):
    """Get file rename/move history (lineage)."""
    storage = _storage(repo_id, data_dir)
    try:
        # Try git_file_lineage table if it exists
        try:
            rows = storage.conn.execute(
                """
                SELECT path, start_commit_oid, end_commit_oid
                FROM git_file_lineage
                WHERE path = ? OR path IN (
                    SELECT path FROM git_file_lineage
                    WHERE path = ?
                )
                ORDER BY rowid
                """,
                (path, path),
            ).fetchall()
            return [
                {
                    "path": r[0],
                    "start_commit_oid": r[1],
                    "end_commit_oid": r[2],
                }
                for r in rows
            ]
        except Exception:
            # Table may not exist — return empty lineage
            return []
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
    data_dir: str = Query(default=None),
):
    storage = _storage(repo_id, data_dir)
    try:
        where = "WHERE e.kind = 'file'"
        params: list = []
        if current_only:
            where += " AND e.exists_at_head = 1"
        if q:
            where += " AND e.qualified_name LIKE ?"
            params.append(f"%{q}%")

        order = "e.qualified_name" if sort_by == "path" else "CAST(json_extract(e.metadata_json, '$.total_commits') AS INTEGER)"
        direction = "ASC" if sort_dir == "asc" else "DESC"

        rows = storage.conn.execute(
            f"""
            SELECT e.entity_id, e.qualified_name AS path,
                   e.exists_at_head, json_extract(e.metadata_json, '$.total_commits') as total_commits
            FROM entities e
            {where}
            ORDER BY {order} {direction}
            LIMIT ?
            """,
            params + [limit],
        ).fetchall()
        return [
            {
                "file_id": r[0],
                "path": r[1],
                "exists_at_head": bool(r[2]),
                "total_commits": r[3] or 0,
            }
            for r in rows
        ]
    finally:
        storage.close()


@router.get("/folders")
async def list_folders(repo_id: str, depth: int | None = None, data_dir: str = Query(default=None)):
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
async def get_file_tree(repo_id: str, data_dir: str = Query(default=None)):
    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()
    return api.get_file_tree(paths.db_path)


@router.get("/refs")
async def list_git_refs(
    repo_id: str,
    q: str = Query("", description="Filter refs by name substring"),
    kind: str = Query("all", description="Filter by kind: branch, tag, or all"),
    limit: int = Query(100, ge=1, le=500),
    data_dir: str = Query(default=None),
):
    """List git branches and tags for a repository (lazy-loaded from disk)."""
    import subprocess

    storage = _storage(repo_id, data_dir)
    try:
        row = storage.conn.execute(
            "SELECT value FROM repo_meta WHERE key = 'source_path'"
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Repository source path not found")
        repo_path = row[0]
    finally:
        storage.close()

    if not Path(repo_path).exists():
        raise HTTPException(status_code=404, detail="Repository path no longer exists on disk")

    refs: list[dict] = []

    if kind in ("branch", "all"):
        try:
            result = subprocess.run(
                ["git", "-C", repo_path, "for-each-ref", "--sort=-committerdate",
                 "--format=%(refname:short)\t%(objectname:short)\t%(committerdate:iso8601)",
                 "refs/heads/"],
                capture_output=True, text=True, timeout=10,
            )
            if result.returncode == 0:
                for line in result.stdout.strip().splitlines():
                    parts = line.split("\t")
                    if len(parts) >= 1:
                        name = parts[0]
                        if q and q.lower() not in name.lower():
                            continue
                        refs.append({
                            "name": name,
                            "kind": "branch",
                            "short_sha": parts[1] if len(parts) > 1 else "",
                            "date": parts[2] if len(parts) > 2 else None,
                        })
        except Exception as exc:
            logger.warning(f"Failed to list branches for {repo_id}: {exc}")

    if kind in ("tag", "all"):
        try:
            result = subprocess.run(
                ["git", "-C", repo_path, "for-each-ref", "--sort=-creatordate",
                 "--format=%(refname:short)\t%(objectname:short)\t%(creatordate:iso8601)",
                 "refs/tags/"],
                capture_output=True, text=True, timeout=10,
            )
            if result.returncode == 0:
                for line in result.stdout.strip().splitlines():
                    parts = line.split("\t")
                    if len(parts) >= 1:
                        name = parts[0]
                        if q and q.lower() not in name.lower():
                            continue
                        refs.append({
                            "name": name,
                            "kind": "tag",
                            "short_sha": parts[1] if len(parts) > 1 else "",
                            "date": parts[2] if len(parts) > 2 else None,
                        })
        except Exception as exc:
            logger.warning(f"Failed to list tags for {repo_id}: {exc}")

    return refs[:limit]


@router.get("/files/{path:path}/history")
async def get_file_history(repo_id: str, path: str, data_dir: str = Query(default=None)):
    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()
    return api.get_file_history(paths.db_path, paths.parquet_dir, path)


@router.get("/files/{path:path}/details")
async def get_file_details(repo_id: str, path: str, data_dir: str = Query(default=None)):
    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()
    return api.get_file_details_enhanced(paths.db_path, paths.parquet_dir, path)


@router.get("/files/{path:path}/activity")
async def get_file_activity(
    repo_id: str,
    path: str,
    granularity: str = "monthly",
    from_date: str | None = None,
    to_date: str | None = None,
    data_dir: str = Query(default=None),
):
    """Per-file activity breakdown with optional time-range filtering."""
    from datetime import datetime, timezone

    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()

    from_ts = None
    to_ts = None
    if from_date:
        try:
            from_ts = int(datetime.fromisoformat(from_date).replace(tzinfo=timezone.utc).timestamp())
        except ValueError:
            raise HTTPException(400, f"Invalid from_date: {from_date}")
    if to_date:
        try:
            to_ts = int(datetime.fromisoformat(to_date).replace(tzinfo=timezone.utc).timestamp())
        except ValueError:
            raise HTTPException(400, f"Invalid to_date: {to_date}")

    if granularity not in ("daily", "weekly", "monthly", "quarterly"):
        raise HTTPException(400, f"Invalid granularity: {granularity}")

    return api.get_file_activity_filtered(
        paths.db_path, paths.parquet_dir, path,
        from_ts=from_ts, to_ts=to_ts, granularity=granularity,
    )


@router.get("/files/{path:path}/authors")
async def get_file_authors(
    repo_id: str,
    path: str,
    from_date: str | None = None,
    to_date: str | None = None,
    granularity: str = "monthly",
    data_dir: str = Query(default=None),
):
    """Per-file author breakdown with bus factor and ownership timeline."""
    from datetime import datetime, timezone

    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()

    from_ts = None
    to_ts = None
    if from_date:
        try:
            from_ts = int(datetime.fromisoformat(from_date).replace(tzinfo=timezone.utc).timestamp())
        except ValueError:
            raise HTTPException(400, f"Invalid from_date: {from_date}")
    if to_date:
        try:
            to_ts = int(datetime.fromisoformat(to_date).replace(tzinfo=timezone.utc).timestamp())
        except ValueError:
            raise HTTPException(400, f"Invalid to_date: {to_date}")

    if granularity not in ("daily", "weekly", "monthly", "quarterly"):
        raise HTTPException(400, f"Invalid granularity: {granularity}")

    return api.get_file_authors_enhanced(
        paths.db_path, paths.parquet_dir, path,
        from_ts=from_ts, to_ts=to_ts, granularity=granularity,
    )


@router.get("/files/{path:path}/commits")
async def get_file_commits(
    repo_id: str,
    path: str,
    search: str | None = None,
    exclude_merges: bool = False,
    limit: int = 100,
    offset: int = 0,
    data_dir: str = Query(default=None),
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
            
            # Issue #6: Handle exclude_merges filter
            if exclude_merges and ci.get("parent_count", 1) > 1:
                continue
                
            msg = ci.get("subject", "") or ""
            if search and search.lower() not in msg.lower():
                continue
            
            # Issue #3: Convert timestamp to ISO date string
            ts = ci.get("authored_ts") or ci.get("committer_ts")
            date_str = None
            if ts:
                from datetime import datetime, timezone
                date_str = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
            
            results.append(
                {
                    "oid": ch.get("commit_oid", ""),
                    "message": msg,
                    "author": ci.get("author_name", "Unknown"),
                    "date": date_str,
                    "lines_added": ch.get("lines_added", 0) or 0,
                    "lines_deleted": ch.get("lines_deleted", 0) or 0,
                }
            )

        total = len(results)
        page = results[offset : offset + limit]
        return {"commits": page, "total_count": total}
    finally:
        storage.close()


@router.get("/files/{path:path}/coupling/timeline")
async def get_file_coupling_timeline(
    repo_id: str,
    path: str,
    granularity: str = "monthly",
    from_date: str | None = None,
    to_date: str | None = None,
    data_dir: str = Query(default=None),
):
    """Coupling evolution timeline for a file."""
    from datetime import datetime, timezone

    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()

    from_ts = None
    to_ts = None
    if from_date:
        try:
            from_ts = int(datetime.fromisoformat(from_date).replace(tzinfo=timezone.utc).timestamp())
        except ValueError:
            raise HTTPException(400, f"Invalid from_date: {from_date}")
    if to_date:
        try:
            to_ts = int(datetime.fromisoformat(to_date).replace(tzinfo=timezone.utc).timestamp())
        except ValueError:
            raise HTTPException(400, f"Invalid to_date: {to_date}")

    if granularity not in ("daily", "weekly", "monthly", "quarterly"):
        raise HTTPException(400, f"Invalid granularity: {granularity}")

    return api.get_file_coupling_timeline(
        paths.db_path, paths.parquet_dir, path,
        from_ts=from_ts, to_ts=to_ts, granularity=granularity,
    )


@router.get("/files/{path:path}/risk/timeline")
async def get_file_risk_timeline(
    repo_id: str,
    path: str,
    granularity: str = "monthly",
    from_date: str | None = None,
    to_date: str | None = None,
    data_dir: str = Query(default=None),
):
    """Risk score evolution timeline for a file."""
    from datetime import datetime, timezone

    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()

    from_ts = None
    to_ts = None
    if from_date:
        try:
            from_ts = int(datetime.fromisoformat(from_date).replace(tzinfo=timezone.utc).timestamp())
        except ValueError:
            raise HTTPException(400, f"Invalid from_date: {from_date}")
    if to_date:
        try:
            to_ts = int(datetime.fromisoformat(to_date).replace(tzinfo=timezone.utc).timestamp())
        except ValueError:
            raise HTTPException(400, f"Invalid to_date: {to_date}")

    if granularity not in ("daily", "weekly", "monthly", "quarterly"):
        raise HTTPException(400, f"Invalid granularity: {granularity}")

    return api.get_file_risk_timeline(
        paths.db_path, paths.parquet_dir, path,
        from_ts=from_ts, to_ts=to_ts, granularity=granularity,
    )


@router.get("/folders/{path:path}/details")
async def get_folder_details(repo_id: str, path: str, data_dir: str = Query(default=None)):
    """Folder-level details."""
    storage = _storage(repo_id, data_dir)
    try:
        pattern = f"{path}/%"
        rows = storage.conn.execute(
            """
            SELECT 
                COUNT(*), 
                SUM(CAST(json_extract(metadata_json, '$.total_commits') AS INTEGER)),
                SUM(CAST(json_extract(metadata_json, '$.authors_count') AS INTEGER)),
                SUM(CAST(json_extract(metadata_json, '$.total_lines_added') AS INTEGER)),
                SUM(CAST(json_extract(metadata_json, '$.total_lines_deleted') AS INTEGER))
            FROM entities
            WHERE exists_at_head = 1 AND kind = 'file' AND qualified_name LIKE ?
            """,
            (pattern,),
        ).fetchone()
        file_count = rows[0] if rows else 0
        total_commits = rows[1] or 0 if rows else 0
        authors_count = rows[2] or 0 if rows else 0
        lines_added = rows[3] or 0 if rows else 0
        lines_deleted = rows[4] or 0 if rows else 0

        # Calculate health score
        health_score = min(100, max(0, 100 - (total_commits / max(file_count, 1))))

        subfolders = storage.conn.execute(
            """
            SELECT DISTINCT
                SUBSTR(qualified_name, LENGTH(?) + 1,
                       INSTR(SUBSTR(qualified_name, LENGTH(?) + 1), '/') - 1
                ) AS sub
            FROM entities
            WHERE exists_at_head = 1 AND kind = 'file' AND qualified_name LIKE ?
              AND INSTR(SUBSTR(qualified_name, LENGTH(?) + 1), '/') > 0
            """,
            (path + "/", path + "/", pattern, path + "/"),
        ).fetchall()

        return {
            "path": path,
            "file_count": file_count,
            "subfolder_count": len(subfolders),
            "total_commits": total_commits,
            "total_lines_added": lines_added,
            "total_lines_deleted": lines_deleted,
            "authors_count": authors_count,
            "top_author": None,
            "health_score": round(health_score, 1),
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
    data_dir: str = Query(default=None),
):
    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()
    return api.get_hotspots(paths.db_path, paths.parquet_dir, limit=limit, sort_by=sort_by)


# ── Clustering ───────────────────────────────────────────────────────────────

@router.get("/clustering/algorithms")
async def get_clustering_algorithms(repo_id: str, data_dir: str = Query(default=None)):
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
    data_dir: str = Query(default=None),
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
async def save_clustering_snapshot(repo_id: str, body: dict, data_dir: str = Query(default=None)):
    import json, uuid
    storage = _storage(repo_id, data_dir)
    try:
        snap_id = uuid.uuid4().hex[:12]
        storage.conn.execute(
            """
            INSERT INTO git_clustering_snapshots (id, name, algorithm, result_json, tags_json, created_at)
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
    except Exception as e:
        logger.error(f"Failed to save clustering snapshot: {e}")
        return {"id": None, "status": "snapshot_table_not_available", "error": str(e)}
    finally:
        storage.close()


@router.get("/clustering/snapshots")
async def list_clustering_snapshots(repo_id: str, data_dir: str = Query(default=None)):
    import json
    storage = _storage(repo_id, data_dir)
    try:
        rows = storage.conn.execute(
            "SELECT id, name, algorithm, created_at, result_json, tags_json FROM git_clustering_snapshots ORDER BY created_at DESC"
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
async def get_clustering_snapshot(repo_id: str, snapshot_id: str, data_dir: str = Query(default=None)):
    import json
    storage = _storage(repo_id, data_dir)
    try:
        row = storage.conn.execute(
            "SELECT name, result_json FROM git_clustering_snapshots WHERE id = ?",
            (snapshot_id,),
        ).fetchone()
        if not row:
            raise HTTPException(404, "Snapshot not found")
        return {"name": row[0], "result": json.loads(row[1]) if row[1] else {}}
    finally:
        storage.close()


@router.put("/clustering/snapshots/{snapshot_id}")
async def update_clustering_snapshot(
    repo_id: str, snapshot_id: str, body: dict, data_dir: str = Query(default=None)
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
            f"UPDATE git_clustering_snapshots SET {', '.join(updates)} WHERE id = ?",
            params,
        )
        storage.conn.commit()
        return {"status": "updated"}
    finally:
        storage.close()


@router.delete("/clustering/snapshots/{snapshot_id}")
async def delete_clustering_snapshot(
    repo_id: str, snapshot_id: str, data_dir: str = Query(default=None)
):
    storage = _storage(repo_id, data_dir)
    try:
        storage.conn.execute(
            "DELETE FROM git_clustering_snapshots WHERE id = ?", (snapshot_id,)
        )
        storage.conn.commit()
        return {"status": "deleted"}
    finally:
        storage.close()


@router.get("/clustering/snapshots/{snapshot_id}/edges")
async def get_snapshot_edges(repo_id: str, snapshot_id: str, data_dir: str = Query(default=None)):
    return {"edges": []}


@router.get("/clustering/compare")
async def compare_snapshots(
    repo_id: str, base: str = "", head: str = "", data_dir: str = Query(default=None)
):
    return {
        "comparisons": [],
        "flows": [],
        "nodes": {"old": [], "new": []},
        "summary": {"stable": 0, "drifted": 0, "dissolved": 0, "new": 0},
    }


# ── Dashboard ────────────────────────────────────────────────────────────────

@router.get("/dashboard/summary")
async def get_dashboard_summary(repo_id: str, data_dir: str = Query(default=None)):
    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()
    return api.get_dashboard_summary(paths.db_path, paths.parquet_dir)


@router.get("/dashboard/trends")
async def get_dashboard_trends(
    repo_id: str, months: int = 6, granularity: str = "monthly", data_dir: str = Query(default=None)
):
    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()
    return api.get_timeline(paths.db_path, paths.parquet_dir, points=months, granularity=granularity)


# ── Authors & Timeline ───────────────────────────────────────────────────────

@router.get("/authors")
async def get_authors(repo_id: str, limit: int = 50, data_dir: str = Query(default=None)):
    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()
    return api.get_authors(paths.db_path, paths.parquet_dir, limit=limit)


@router.get("/timeline")
async def get_timeline(
    repo_id: str,
    points: int = 12,
    granularity: str = "monthly",
    data_dir: str = Query(default=None),
):
    paths = _paths(repo_id, data_dir)
    api = registry.get_git_api()
    return api.get_timeline(
        paths.db_path, paths.parquet_dir, points=points, granularity=granularity
    )
