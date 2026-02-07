from __future__ import annotations
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from code_intel.config import RepoPaths
from code_intel.registry import registry
from code_intel.storage import Storage

router = APIRouter(prefix="/repos/{repo_id}/semantic", tags=["semantic"])

def _paths(repo_id: str, data_dir: str) -> RepoPaths:
    return RepoPaths(Path(data_dir), repo_id)

def _storage(repo_id: str, data_dir: str = "data") -> Storage:
    paths = _paths(repo_id, data_dir)
    return Storage(paths.db_path, paths.parquet_dir)

@router.get("/domains")
async def get_domains(repo_id: str, data_dir: str = "data"):
    try:
        paths = _paths(repo_id, data_dir)
        api = registry.get_semantic_api()
        return api.get_domains(paths.db_path)
    except ValueError:
        return []

@router.get("/files/{path:path}/classify")
async def classify_file(repo_id: str, path: str, data_dir: str = "data"):
    try:
        paths = _paths(repo_id, data_dir)
        api = registry.get_semantic_api()
        return api.classify_file(paths.db_path, path)
    except ValueError:
        return {"path": path, "domains": [], "primary_domain": None}

@router.get("/files/{path:path}/similar")
async def get_similar_files(repo_id: str, path: str, limit: int = 10, min_similarity: float = 0.5, data_dir: str = "data"):
    try:
        paths = _paths(repo_id, data_dir)
        api = registry.get_semantic_api()
        return api.get_similar_files(paths.db_path, path, limit=limit, min_similarity=min_similarity)
    except ValueError:
        return []

@router.get("/domains/{domain_id}")
async def get_domain_detail(repo_id: str, domain_id: int, data_dir: str = "data"):
    try:
        paths = _paths(repo_id, data_dir)
        api = registry.get_semantic_api()
        return api.get_domain_detail(paths.db_path, domain_id)
    except ValueError:
        raise HTTPException(404, "Semantic analyzer not available")

@router.get("/files/{path:path}/tokens")
async def get_file_tokens(repo_id: str, path: str, data_dir: str = "data"):
    """Get token analysis for a file — BUG #6 fix."""
    storage = _storage(repo_id, data_dir)
    try:
        row = storage.conn.execute(
            "SELECT entity_id, metadata_json FROM entities WHERE qualified_name = ? AND kind = 'file'",
            (path,),
        ).fetchone()
        if not row:
            raise HTTPException(404, "File not found")

        metadata = json.loads(row[1]) if row[1] else {}
        tokens = metadata.get("tokens", [])
        token_count = metadata.get("token_count", len(tokens))
        unique_tokens = metadata.get("unique_tokens", len(set(tokens)))

        return {
            "path": path,
            "entity_id": row[0],
            "token_count": token_count,
            "unique_tokens": unique_tokens,
            "tokens": tokens[:200],  # Limit returned tokens
        }
    except HTTPException:
        raise
    except Exception:
        return {"path": path, "token_count": 0, "unique_tokens": 0, "tokens": []}
    finally:
        storage.close()

@router.get("/bridges")
async def get_bridge_entities(repo_id: str, limit: int = 50, data_dir: str = "data"):
    """Get bridge entities that connect multiple domains — BUG #6 fix."""
    storage = _storage(repo_id, data_dir)
    try:
        # Find entities that appear in relationships across different source types
        rows = storage.conn.execute(
            """
            SELECT e.entity_id, e.qualified_name, e.kind,
                   COUNT(DISTINCT r.source_type) as source_count,
                   COUNT(DISTINCT r.dst_entity_id) as connection_count
            FROM entities e
            JOIN relationships r ON e.entity_id = r.src_entity_id
            WHERE e.exists_at_head = 1
            GROUP BY e.entity_id
            HAVING source_count > 1
            ORDER BY connection_count DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

        return [
            {
                "entity_id": r[0],
                "path": r[1],
                "kind": r[2],
                "source_type_count": r[3],
                "connection_count": r[4],
            }
            for r in rows
        ]
    except Exception:
        return []
    finally:
        storage.close()
