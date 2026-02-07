from __future__ import annotations
from pathlib import Path
from fastapi import APIRouter
from code_intel.config import RepoPaths
from code_intel.registry import registry

router = APIRouter(prefix="/repos/{repo_id}/deps", tags=["deps"])

def _paths(repo_id: str, data_dir: str) -> RepoPaths:
    return RepoPaths(Path(data_dir), repo_id)

@router.get("/graph")
async def get_import_graph(repo_id: str, language: str | None = None, min_imports: int = 1, data_dir: str = "data"):
    paths = _paths(repo_id, data_dir)
    api = registry.get_dep_api()
    return api.get_import_graph(paths.db_path, language=language, min_imports=min_imports)

@router.get("/files/{path:path}")
async def get_file_imports(repo_id: str, path: str, data_dir: str = "data"):
    paths = _paths(repo_id, data_dir)
    api = registry.get_dep_api()
    return api.get_file_imports(paths.db_path, path)

@router.get("/circular")
async def get_circular_deps(repo_id: str, data_dir: str = "data"):
    paths = _paths(repo_id, data_dir)
    api = registry.get_dep_api()
    return api.get_circular_deps(paths.db_path)

@router.get("/external")
async def get_external_packages(repo_id: str, data_dir: str = "data"):
    paths = _paths(repo_id, data_dir)
    api = registry.get_dep_api()
    return api.get_external_packages(paths.db_path)

@router.get("/stats")
async def get_dependency_stats(repo_id: str, data_dir: str = "data"):
    paths = _paths(repo_id, data_dir)
    api = registry.get_dep_api()
    return api.get_dependency_stats(paths.db_path)
