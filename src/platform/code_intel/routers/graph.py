from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from code_intel.config import RepoPaths, DEFAULT_DATA_DIR
from code_intel.storage import Storage
from code_intel.logging_utils import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/repos/{repo_id}/graph", tags=["graph"])


def _storage(repo_id: str, data_dir: str | None = None) -> Storage:
    paths = RepoPaths(Path(data_dir) if data_dir else DEFAULT_DATA_DIR, repo_id)
    return Storage(paths.db_path, paths.parquet_dir)


def _entity_row_to_dict(row) -> dict:
    return {
        "entity_id": row["entity_id"],
        "qualified_name": row["qualified_name"],
        "name": row["name"],
        "kind": row["kind"],
        "language": row["language"],
        "parent_id": row["parent_id"],
        "metadata": json.loads(row["metadata_json"]) if row["metadata_json"] else {},
    }


@router.get("/entities")
async def search_entities(
    repo_id: str,
    q: str | None = None,
    kind: str | None = None,
    language: str | None = None,
    limit: int = 50,
    offset: int = 0,
    data_dir: str = Query(default=None),
):
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        where = "WHERE 1=1"
        params: list = []
        if q:
            where += " AND (qualified_name LIKE ? OR name LIKE ?)"
            params.extend([f"%{q}%", f"%{q}%"])
        if kind:
            where += " AND kind = ?"
            params.append(kind)
        if language:
            where += " AND language = ?"
            params.append(language)

        rows = storage.conn.execute(
            f"""
            SELECT entity_id, kind, name, qualified_name, language, parent_id, metadata_json
            FROM entities {where}
            ORDER BY qualified_name
            LIMIT ? OFFSET ?
            """,
            params + [limit, offset],
        ).fetchall()
        return [_entity_row_to_dict(r) for r in rows]
    finally:
        storage.close()


@router.get("/entities/{entity_id}")
async def get_entity_detail(repo_id: str, entity_id: int, data_dir: str = Query(default=None)):
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        row = storage.conn.execute(
            "SELECT entity_id, kind, name, qualified_name, language, parent_id, metadata_json FROM entities WHERE entity_id = ?",
            (entity_id,),
        ).fetchone()
        if not row:
            raise HTTPException(404, "Entity not found")

        entity = _entity_row_to_dict(row)

        outgoing = storage.conn.execute(
            """
            SELECT r.rel_id, r.source_type, r.rel_kind, r.src_entity_id, r.dst_entity_id,
                   r.weight, r.properties_json, r.run_id,
                   e.entity_id, e.kind, e.name, e.qualified_name, e.language, e.parent_id, e.metadata_json
            FROM relationships r
            JOIN entities e ON r.dst_entity_id = e.entity_id
            WHERE r.src_entity_id = ?
            ORDER BY r.weight DESC
            LIMIT 100
            """,
            (entity_id,),
        ).fetchall()

        incoming = storage.conn.execute(
            """
            SELECT r.rel_id, r.source_type, r.rel_kind, r.src_entity_id, r.dst_entity_id,
                   r.weight, r.properties_json, r.run_id,
                   e.entity_id, e.kind, e.name, e.qualified_name, e.language, e.parent_id, e.metadata_json
            FROM relationships r
            JOIN entities e ON r.src_entity_id = e.entity_id
            WHERE r.dst_entity_id = ?
            ORDER BY r.weight DESC
            LIMIT 100
            """,
            (entity_id,),
        ).fetchall()

        def _rel_with_entity(r, entity_key):
            rel = {
                "rel_id": r["rel_id"],
                "source_type": r["source_type"],
                "rel_kind": r["rel_kind"],
                "src_entity_id": r["src_entity_id"],
                "dst_entity_id": r["dst_entity_id"],
                "weight": r["weight"],
                "metadata": json.loads(r["properties_json"]) if r["properties_json"] else {},
                "run_id": r["run_id"],
            }
            ent = {
                "entity_id": r[8],
                "kind": r[9],
                "name": r[10],
                "qualified_name": r[11],
                "language": r[12],
                "parent_id": r[13],
                "metadata": json.loads(r[14]) if r[14] else {},
            }
            rel[entity_key] = ent
            return rel

        entity["relationships"] = {
            "outgoing": [_rel_with_entity(r, "dst_entity") for r in outgoing],
            "incoming": [_rel_with_entity(r, "src_entity") for r in incoming],
        }

        return entity
    finally:
        storage.close()


@router.get("/relationships")
async def get_relationships(
    repo_id: str,
    source_type: str | None = None,
    rel_kind: str | None = None,
    min_weight: float = 0.0,
    limit: int = 100,
    data_dir: str = Query(default=None),
):
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        where = "WHERE weight >= ?"
        params: list = [min_weight]
        if source_type:
            where += " AND source_type = ?"
            params.append(source_type)
        if rel_kind:
            where += " AND rel_kind = ?"
            params.append(rel_kind)

        rows = storage.conn.execute(
            f"""
            SELECT rel_id, source_type, rel_kind, src_entity_id, dst_entity_id,
                   weight, properties_json, run_id
            FROM relationships {where}
            ORDER BY weight DESC
            LIMIT ?
            """,
            params + [limit],
        ).fetchall()
        return [
            {
                "rel_id": r["rel_id"],
                "source_type": r["source_type"],
                "rel_kind": r["rel_kind"],
                "src_entity_id": r["src_entity_id"],
                "dst_entity_id": r["dst_entity_id"],
                "weight": r["weight"],
                "metadata": json.loads(r["properties_json"]) if r["properties_json"] else {},
                "run_id": r["run_id"],
            }
            for r in rows
        ]
    finally:
        storage.close()


@router.get("/neighbors/{entity_id}")
async def get_neighbors(
    repo_id: str,
    entity_id: int,
    max_depth: int = 1,
    min_weight: float = 0.0,
    data_dir: str = Query(default=None),
):
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        center_row = storage.conn.execute(
            "SELECT entity_id, kind, name, qualified_name, language, parent_id, metadata_json FROM entities WHERE entity_id = ?",
            (entity_id,),
        ).fetchone()
        if not center_row:
            raise HTTPException(404, "Entity not found")

        center = _entity_row_to_dict(center_row)

        rel_rows = storage.conn.execute(
            """
            SELECT r.src_entity_id, r.dst_entity_id, r.source_type, r.rel_kind, r.weight
            FROM relationships r
            WHERE (r.src_entity_id = ? OR r.dst_entity_id = ?) AND r.weight >= ?
            ORDER BY r.weight DESC
            LIMIT 200
            """,
            (entity_id, entity_id, min_weight),
        ).fetchall()

        node_ids = {entity_id}
        edges = []
        for r in rel_rows:
            edges.append({
                "source": r["src_entity_id"],
                "target": r["dst_entity_id"],
                "source_type": r["source_type"],
                "rel_kind": r["rel_kind"],
                "weight": r["weight"],
            })
            node_ids.add(r["src_entity_id"])
            node_ids.add(r["dst_entity_id"])

        if node_ids:
            placeholders = ",".join("?" * len(node_ids))
            entity_rows = storage.conn.execute(
                f"""
                SELECT entity_id, kind, name, qualified_name, language, parent_id, metadata_json
                FROM entities WHERE entity_id IN ({placeholders})
                """,
                list(node_ids),
            ).fetchall()
        else:
            entity_rows = []

        degree_map: dict[int, int] = {}
        for e in edges:
            degree_map[e["source"]] = degree_map.get(e["source"], 0) + 1
            degree_map[e["target"]] = degree_map.get(e["target"], 0) + 1

        nodes = [
            {"id": r["entity_id"], "entity": _entity_row_to_dict(r), "degree": degree_map.get(r["entity_id"], 0)}
            for r in entity_rows
        ]

        return {"center": center, "nodes": nodes, "edges": edges}
    finally:
        storage.close()


@router.get("/path")
async def find_path(
    repo_id: str,
    from_id: int = Query(..., alias="from"),
    to_id: int = Query(..., alias="to"),
    max_length: int = 5,
    data_dir: str = Query(default=None),
):
    storage = _storage(repo_id, data_dir)
    try:
        from collections import deque

        visited = {from_id: None}
        queue: deque = deque([(from_id, 0)])
        found = False

        while queue and not found:
            current, depth = queue.popleft()
            if depth >= max_length:
                continue

            neighbors = storage.conn.execute(
                """
                SELECT dst_entity_id FROM relationships WHERE src_entity_id = ?
                UNION
                SELECT src_entity_id FROM relationships WHERE dst_entity_id = ?
                """,
                (current, current),
            ).fetchall()

            for (nid,) in neighbors:
                if nid not in visited:
                    visited[nid] = current
                    if nid == to_id:
                        found = True
                        break
                    queue.append((nid, depth + 1))

        if not found:
            return {"path": [], "edges": [], "length": 0, "total_weight": 0}

        path_ids = []
        node = to_id
        while node is not None:
            path_ids.append(node)
            node = visited[node]
        path_ids.reverse()

        if path_ids:
            placeholders = ",".join("?" * len(path_ids))
            path_entities = storage.conn.execute(
                f"SELECT entity_id, kind, name, qualified_name, language, parent_id, metadata_json FROM entities WHERE entity_id IN ({placeholders})",
                path_ids,
            ).fetchall()
            entity_map = {r["entity_id"]: _entity_row_to_dict(r) for r in path_entities}
            path = [entity_map[eid] for eid in path_ids if eid in entity_map]
        else:
            path = []

        path_edges = []
        total_weight = 0.0
        for i in range(len(path_ids) - 1):
            rel_row = storage.conn.execute(
                """
                SELECT rel_id, source_type, rel_kind, src_entity_id, dst_entity_id, weight, properties_json, run_id
                FROM relationships
                WHERE (src_entity_id = ? AND dst_entity_id = ?) OR (src_entity_id = ? AND dst_entity_id = ?)
                LIMIT 1
                """,
                (path_ids[i], path_ids[i+1], path_ids[i+1], path_ids[i]),
            ).fetchone()
            if rel_row:
                path_edges.append({
                    "rel_id": rel_row["rel_id"],
                    "source_type": rel_row["source_type"],
                    "rel_kind": rel_row["rel_kind"],
                    "src_entity_id": rel_row["src_entity_id"],
                    "dst_entity_id": rel_row["dst_entity_id"],
                    "weight": rel_row["weight"],
                    "metadata": json.loads(rel_row["properties_json"]) if rel_row["properties_json"] else {},
                    "run_id": rel_row["run_id"],
                })
                total_weight += rel_row["weight"]

        return {"path": path, "edges": path_edges, "length": len(path_ids), "total_weight": round(total_weight, 3)}
    finally:
        storage.close()


@router.get("/stats")
async def get_graph_stats(repo_id: str, data_dir: str = Query(default=None)):
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        total_entities = storage.conn.execute("SELECT COUNT(*) FROM entities").fetchone()[0]
        total_relationships = storage.conn.execute("SELECT COUNT(*) FROM relationships").fetchone()[0]

        by_source_rows = storage.conn.execute(
            "SELECT source_type, COUNT(*) FROM relationships GROUP BY source_type"
        ).fetchall()
        by_source = {r[0]: r[1] for r in by_source_rows}

        by_kind_rows = storage.conn.execute(
            "SELECT kind, COUNT(*) FROM entities GROUP BY kind"
        ).fetchall()
        by_kind = {r[0]: r[1] for r in by_kind_rows}

        degree_row = storage.conn.execute(
            """
            SELECT AVG(deg), MAX(deg) FROM (
                SELECT COUNT(*) as deg FROM relationships GROUP BY src_entity_id
            )
            """
        ).fetchone()
        avg_degree = round(degree_row[0], 2) if degree_row and degree_row[0] else 0
        max_degree = degree_row[1] if degree_row and degree_row[1] else 0

        density = 0.0
        if total_entities > 1:
            max_edges = total_entities * (total_entities - 1)
            density = round(total_relationships / max_edges, 6) if max_edges > 0 else 0

        return {
            "total_entities": total_entities,
            "total_relationships": total_relationships,
            "by_source": by_source,
            "by_kind": by_kind,
            "avg_degree": avg_degree,
            "max_degree": max_degree,
            "density": density,
        }
    except Exception as e:
        logger.warning(f"Graph stats failed: {e}")
        return {
            "total_entities": 0, "total_relationships": 0,
            "by_source": {}, "by_kind": {},
            "avg_degree": 0, "max_degree": 0, "density": 0,
        }
    finally:
        storage.close()
