from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter
from code_intel.config import RepoPaths
from code_intel.registry import registry
from code_intel.storage import Storage
from code_intel.logging_utils import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/repos/{repo_id}/semantic", tags=["semantic"])


def _paths(repo_id: str, data_dir: str) -> RepoPaths:
    return RepoPaths(Path(data_dir), repo_id)


def _storage(repo_id: str, data_dir: str) -> Storage:
    paths = RepoPaths(Path(data_dir), repo_id)
    return Storage(paths.db_path, paths.parquet_dir)


@router.get("/domains")
async def get_domains(repo_id: str, data_dir: str = "data"):
    paths = _paths(repo_id, data_dir)
    api = registry.get_semantic_api()
    return api.get_domains(paths.db_path)


@router.get("/files/{path:path}/classify")
async def classify_file(repo_id: str, path: str, data_dir: str = "data"):
    paths = _paths(repo_id, data_dir)
    api = registry.get_semantic_api()
    return api.classify_file(paths.db_path, path)


@router.get("/files/{path:path}/similar")
async def get_similar_files(repo_id: str, path: str, limit: int = 10, min_similarity: float = 0.5, data_dir: str = "data"):
    paths = _paths(repo_id, data_dir)
    api = registry.get_semantic_api()
    return api.get_similar_files(paths.db_path, path, limit=limit, min_similarity=min_similarity)


@router.get("/domains/{domain_id}")
async def get_domain_detail(repo_id: str, domain_id: int, data_dir: str = "data"):
    paths = _paths(repo_id, data_dir)
    api = registry.get_semantic_api()
    return api.get_domain_detail(paths.db_path, domain_id)


@router.get("/files/{path:path}/tokens")
async def get_file_tokens(repo_id: str, path: str, data_dir: str = "data"):
    storage = _storage(repo_id, data_dir)
    try:
        row = storage.conn.execute(
            "SELECT entity_id, metadata_json FROM entities WHERE qualified_name = ? AND kind = 'file'",
            (path,),
        ).fetchone()
        if not row:
            return {"file_path": path, "tokens": []}

        metadata = json.loads(row["metadata_json"]) if row["metadata_json"] else {}
        tokens = metadata.get("tokens", [])
        return {"file_path": path, "tokens": tokens}
    finally:
        storage.close()


@router.get("/bridges")
async def get_bridge_entities(repo_id: str, min_domains: int = 2, data_dir: str = "data"):
    storage = _storage(repo_id, data_dir)
    try:
        rows = storage.conn.execute(
            """
            SELECT e.qualified_name AS path, COUNT(DISTINCT r.dst_entity_id) AS domain_count
            FROM relationships r
            JOIN entities e ON r.src_entity_id = e.entity_id
            WHERE r.source_type = 'semantic' AND r.rel_kind = 'BELONGS_TO_DOMAIN'
              AND e.kind = 'file'
            GROUP BY e.entity_id
            HAVING domain_count >= ?
            ORDER BY domain_count DESC
            """,
            (min_domains,),
        ).fetchall()

        results = []
        for r in rows:
            domain_rows = storage.conn.execute(
                """
                SELECT r.dst_entity_id AS domain_id, e.name AS domain_name, r.weight AS score
                FROM relationships r
                JOIN entities e ON r.dst_entity_id = e.entity_id
                WHERE r.src_entity_id = (SELECT entity_id FROM entities WHERE qualified_name = ? AND kind = 'file')
                  AND r.source_type = 'semantic' AND r.rel_kind = 'BELONGS_TO_DOMAIN'
                """,
                (r["path"],),
            ).fetchall()
            results.append({
                "path": r["path"],
                "domain_count": r["domain_count"],
                "domains": [{"domain_id": d["domain_id"], "domain_name": d["domain_name"], "score": d["score"]} for d in domain_rows],
            })
        return results
    except Exception:
        return []
    finally:
        storage.close()
