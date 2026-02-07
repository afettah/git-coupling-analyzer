from __future__ import annotations
from pathlib import Path
from code_intel_interfaces.intelligence import IntelligenceAPI

class IntelAPI(IntelligenceAPI):
    """Stub implementation of IntelligenceAPI."""

    def get_risk_overview(self, db_path: Path) -> dict:
        return {"hotspots": []}

    def get_entity_risk(self, db_path: Path, entity_id: int) -> dict:
        return {"score": 0, "factors": []}

    def get_knowledge_graph(self, db_path: Path) -> dict:
        return {"nodes": [], "edges": []}
