from __future__ import annotations
from typing import Any
from code_intel_interfaces.analyzer import BaseAnalyzer
from code_intel_interfaces.git_analyzer import GitAnalyzerAPI
from code_intel_interfaces.dep_analyzer import DepAnalyzerAPI
from code_intel_interfaces.semantic_analyzer import SemanticAnalyzerAPI


class AnalyzerRegistry:
    """
    Central registry. Analyzers register themselves at import time.
    The orchestrator uses this to discover and dispatch to analyzers.
    """

    def __init__(self):
        self._analyzers: dict[str, BaseAnalyzer] = {}
        self._apis: dict[str, Any] = {}     # analyzer_type → API impl

    def register(self, analyzer: BaseAnalyzer, api: Any = None):
        """Register an analyzer and its query API."""
        self._analyzers[analyzer.analyzer_type] = analyzer
        if api is not None:
            self._apis[analyzer.analyzer_type] = api

    def get_analyzer(self, analyzer_type: str) -> BaseAnalyzer:
        if analyzer_type not in self._analyzers:
            raise ValueError(f"Unknown analyzer: {analyzer_type}. "
                           f"Available: {list(self._analyzers.keys())}")
        return self._analyzers[analyzer_type]

    def get_api(self, analyzer_type: str) -> Any:
        """Get the query API for an analyzer type."""
        if analyzer_type not in self._apis:
            raise ValueError(f"No API registered for: {analyzer_type}")
        return self._apis[analyzer_type]

    def get_git_api(self) -> GitAnalyzerAPI:
        return self._apis["git"]

    def get_dep_api(self) -> DepAnalyzerAPI:
        return self._apis["deps"]

    def get_semantic_api(self) -> SemanticAnalyzerAPI:
        return self._apis["semantic"]

    def list_all(self) -> list[dict]:
        return [
            {
                "type": a.analyzer_type,
                "display_name": a.display_name,
                "config_schema": a.get_config_schema(),
            }
            for a in self._analyzers.values()
        ]


# Global singleton
registry = AnalyzerRegistry()
