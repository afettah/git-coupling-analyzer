from abc import ABC, abstractmethod
from pathlib import Path


class IntelligenceAPI(ABC):
    """Query interface for cross-source project intelligence."""

    @abstractmethod
    def get_risk_overview(self, db_path: Path) -> dict:
        """Get project-wide risk hotspots."""
        ...

    @abstractmethod
    def get_entity_risk(self, db_path: Path, entity_id: int) -> dict:
        """Get detailed risk breakdown for an entity."""
        ...

    @abstractmethod
    def get_knowledge_graph(self, db_path: Path) -> dict:
        """Get combined knowledge graph (git + deps + semantic)."""
        ...
