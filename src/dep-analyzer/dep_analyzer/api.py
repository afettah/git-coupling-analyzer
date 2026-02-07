from __future__ import annotations
from pathlib import Path
from code_intel_interfaces.dep_analyzer import DepAnalyzerAPI

class DepAPI(DepAnalyzerAPI):
    """Stub implementation of DepAnalyzerAPI."""

    def get_import_graph(self, db_path: Path, *, language: str | None = None, min_imports: int = 1) -> dict:
        return {"nodes": [], "edges": []}

    def get_file_imports(self, db_path: Path, file_path: str) -> dict:
        return {"imports": [], "imported_by": []}

    def get_circular_deps(self, db_path: Path) -> list[dict]:
        return []

    def get_external_packages(self, db_path: Path) -> list[dict]:
        return []

    def get_dependency_stats(self, db_path: Path) -> dict:
        return {
            "total_imports": 0,
            "external_count": 0,
            "circular_count": 0
        }
