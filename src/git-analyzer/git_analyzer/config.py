"""Coupling analysis configuration."""

from __future__ import annotations
from dataclasses import dataclass, asdict

from code_intel.config import ValidationMode


@dataclass
class CouplingConfig:
    """Global coupling analysis configuration."""
    
    # Commit-level filters
    min_revisions: int = 5
    max_changeset_size: int = 50
    
    # Changeset grouping
    changeset_mode: str = "by_commit"  # by_commit | by_author_time | by_ticket_id
    author_time_window_hours: int = 24
    ticket_id_pattern: str | None = None
    
    # Logical changeset filters
    max_logical_changeset_size: int = 100
    
    # File-level thresholds
    min_cooccurrence: int = 5
    
    # Component level
    component_depth: int = 2
    min_component_cooccurrence: int = 5
    
    # Time filters
    window_days: int | None = None
    decay_half_life_days: int | None = None
    
    # Edge computation
    topk_edges_per_file: int = 50
    
    # Validation settings
    validation_mode: ValidationMode = ValidationMode.SOFT
    max_validation_issues: int = 200  # Cap logged issues per run for performance
    
    def to_dict(self) -> dict:
        """Convert config to dict with proper serialization."""
        data = asdict(self)
        # Convert ValidationMode enum to value
        data["validation_mode"] = self.validation_mode.value
        return data
    
    @classmethod
    def from_dict(cls, data: dict) -> "CouplingConfig":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
