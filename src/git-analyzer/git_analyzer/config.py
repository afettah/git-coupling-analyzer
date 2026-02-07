"""Coupling analysis configuration."""

from __future__ import annotations
from dataclasses import dataclass

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
        return {
            "min_revisions": self.min_revisions,
            "max_changeset_size": self.max_changeset_size,
            "changeset_mode": self.changeset_mode,
            "author_time_window_hours": self.author_time_window_hours,
            "ticket_id_pattern": self.ticket_id_pattern,
            "max_logical_changeset_size": self.max_logical_changeset_size,
            "min_cooccurrence": self.min_cooccurrence,
            "component_depth": self.component_depth,
            "min_component_cooccurrence": self.min_component_cooccurrence,
            "window_days": self.window_days,
            "decay_half_life_days": self.decay_half_life_days,
            "topk_edges_per_file": self.topk_edges_per_file,
            "validation_mode": self.validation_mode.value,
            "max_validation_issues": self.max_validation_issues,
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "CouplingConfig":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
