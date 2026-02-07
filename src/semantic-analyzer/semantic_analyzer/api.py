from __future__ import annotations
from pathlib import Path
from code_intel_interfaces.semantic_analyzer import SemanticAnalyzerAPI

class SemanticAPI(SemanticAnalyzerAPI):
    """Stub implementation of SemanticAnalyzerAPI."""

    def get_domains(self, db_path: Path) -> list[dict]:
        return []

    def classify_file(self, db_path: Path, file_path: str) -> dict:
        return {"domains": []}

    def get_similar_files(self, db_path: Path, file_path: str, *, limit: int = 10, min_similarity: float = 0.5) -> list[dict]:
        return []

    def get_file_tokens(self, db_path: Path, file_path: str) -> dict:
        return {"tokens": []}

    def get_domain_detail(self, db_path: Path, domain_id: int) -> dict:
        return {}

    def get_bridge_entities(self, db_path: Path) -> list[dict]:
        return []
