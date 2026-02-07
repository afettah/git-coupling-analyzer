from __future__ import annotations
from pathlib import Path
from typing import Any

from code_intel_interfaces.analyzer import BaseAnalyzer, AnalysisTask, TaskResult, TaskStatus
from dep_analyzer.api import DepAPI

class DepPlugin(BaseAnalyzer):
    """Stub implementation of DepAnalyzer plugin."""

    @property
    def analyzer_type(self) -> str:
        return "deps"

    @property
    def display_name(self) -> str:
        return "Dependency Analysis"

    def get_config_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "languages": {
                    "type": "array",
                    "items": {"type": "string"},
                    "default": ["python", "typescript"]
                }
            }
        }

    def analyze(self, task: AnalysisTask) -> TaskResult:
        """Stub analysis."""
        return TaskResult(
            task_id=task.task_id,
            status=TaskStatus.COMPLETED,
            entity_count=0,
            relationship_count=0,
            metrics={"status": "stub_completed"}
        )

    def validate_config(self, config: dict) -> list[str]:
        return []

# Export for registration
plugin = DepPlugin()
api = DepAPI()
