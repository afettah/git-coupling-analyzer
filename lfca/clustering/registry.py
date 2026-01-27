"""Algorithm registry."""

from __future__ import annotations

from typing import Type

from lfca.clustering.base import ClusterAlgorithm

_REGISTRY: dict[str, Type[ClusterAlgorithm]] = {}


def register(cls: Type[ClusterAlgorithm]) -> Type[ClusterAlgorithm]:
    """Decorator to register an algorithm."""
    _REGISTRY[cls.name] = cls
    return cls


def get_algorithm(name: str) -> ClusterAlgorithm:
    """Get algorithm instance by name."""
    if name not in _REGISTRY:
        raise ValueError(f"Unknown algorithm: {name}. Available: {list(_REGISTRY.keys())}")
    return _REGISTRY[name]()


def list_algorithms() -> list[dict]:
    """List available algorithms with their parameter schemas."""
    return [
        {"name": name, "params_schema": cls.get_params_schema()}
        for name, cls in _REGISTRY.items()
    ]
