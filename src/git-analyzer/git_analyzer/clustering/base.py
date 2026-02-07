"""Base clustering interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ClusterResult:
    algorithm: str
    parameters: dict
    cluster_count: int
    clusters: list[dict]  # [{id, size, file_ids, files, ...}]
    metrics: dict = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        return {
            "algorithm": self.algorithm,
            "parameters": self.parameters,
            "cluster_count": self.cluster_count,
            "clusters": self.clusters,
            "metrics": self.metrics
        }


class ClusterAlgorithm(ABC):
    """Base class for clustering algorithms."""
    
    name: str = "base"
    
    @classmethod
    @abstractmethod
    def get_params_schema(cls) -> dict:
        """Return JSON schema for algorithm parameters."""
        pass
    
    @abstractmethod
    def run(
        self,
        edges: list[dict],
        file_ids: set[int],
        file_paths: dict[int, str],
        params: dict
    ) -> ClusterResult:
        """Run clustering."""
        pass
