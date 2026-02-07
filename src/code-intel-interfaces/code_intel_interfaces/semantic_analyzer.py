from abc import ABC, abstractmethod
from pathlib import Path


class SemanticAnalyzerAPI(ABC):
    """Query interface specific to semantic analysis."""

    @abstractmethod
    def get_domains(self, db_path: Path) -> list[dict]:
        """All discovered domains with stats."""
        ...

    @abstractmethod
    def classify_file(self, db_path: Path, file_path: str) -> dict:
        """Which domain(s) does this file belong to?"""
        ...

    @abstractmethod
    def get_similar_files(self, db_path: Path, file_path: str, *,
                          limit: int = 10, min_similarity: float = 0.5) -> list[dict]:
        """Find semantically similar files."""
        ...

    @abstractmethod
    def get_file_tokens(self, db_path: Path, file_path: str) -> dict:
        """Extracted semantic tokens for a file."""
        ...

    @abstractmethod
    def get_domain_detail(self, db_path: Path, domain_id: int) -> dict:
        """Detailed info about a domain: files, terms, cross-coupling."""
        ...

    @abstractmethod
    def get_bridge_entities(self, db_path: Path) -> list[dict]:
        """Entities that span multiple domains."""
        ...
