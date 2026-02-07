from abc import ABC, abstractmethod
from pathlib import Path


class DepAnalyzerAPI(ABC):
    """Query interface specific to dependency analysis."""

    @abstractmethod
    def get_import_graph(self, db_path: Path, *,
                         language: str | None = None,
                         min_imports: int = 1) -> dict:
        """Full import graph (nodes + edges) for visualization."""
        ...

    @abstractmethod
    def get_file_imports(self, db_path: Path, file_path: str) -> dict:
        """What this file imports and what imports this file."""
        ...

    @abstractmethod
    def get_circular_deps(self, db_path: Path) -> list[dict]:
        """Detect circular dependency chains."""
        ...

    @abstractmethod
    def get_external_packages(self, db_path: Path) -> list[dict]:
        """External packages used across codebase."""
        ...

    @abstractmethod
    def get_dependency_stats(self, db_path: Path) -> dict:
        """Summary: total imports, external count, circular count, etc."""
        ...
