from __future__ import annotations
from pathlib import Path
from fastapi import APIRouter
from code_intel.config import RepoPaths
from code_intel.registry import registry

router = APIRouter(prefix="/repos/{repo_id}/semantic", tags=["semantic"])

def _paths(repo_id: str, data_dir: str) -> RepoPaths:
    return RepoPaths(Path(data_dir), repo_id)

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
