from __future__ import annotations
from pathlib import Path
from fastapi import APIRouter
from code_intel.config import RepoPaths
from code_intel.registry import registry

router = APIRouter(prefix="/repos/{repo_id}/intel", tags=["intelligence"])

def _paths(repo_id: str, data_dir: str) -> RepoPaths:
    return RepoPaths(Path(data_dir), repo_id)

@router.get("/risk/overview")
async def get_risk_overview(repo_id: str, data_dir: str = "data"):
    paths = _paths(repo_id, data_dir)
    api = registry.get_api("intelligence")
    return api.get_risk_overview(paths.db_path)

@router.get("/risk/entities/{entity_id}")
async def get_entity_risk(repo_id: str, entity_id: int, data_dir: str = "data"):
    paths = _paths(repo_id, data_dir)
    api = registry.get_api("intelligence")
    return api.get_entity_risk(paths.db_path, entity_id)

@router.get("/graph")
async def get_knowledge_graph(repo_id: str, data_dir: str = "data"):
    paths = _paths(repo_id, data_dir)
    api = registry.get_api("intelligence")
    return api.get_knowledge_graph(paths.db_path)
