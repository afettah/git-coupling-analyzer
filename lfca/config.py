"""Configuration and path management."""

from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from pathlib import Path


class ValidationMode(str, Enum):
    """Validation mode for git log parsing.
    
    - strict: Abort on any invalid token (for CI pipelines, data quality gates)
    - soft: Log issues and skip invalid tokens (default, balanced approach)
    - permissive: Accept questionable data, tag for filtering (exploratory analysis)
    """
    STRICT = "strict"
    SOFT = "soft"
    PERMISSIVE = "permissive"


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


@dataclass(frozen=True)
class RepoPaths:
    data_dir: Path
    repo_id: str

    @property
    def repo_root(self) -> Path:
        return self.data_dir / "repos" / self.repo_id

    @property
    def mirror_path(self) -> Path:
        return self.repo_root / "mirror.git"

    @property
    def db_path(self) -> Path:
        return self.repo_root / "lfca.sqlite"

    @property
    def parquet_dir(self) -> Path:
        return self.repo_root / "parquet"

    @property
    def snapshots_dir(self) -> Path:
        return self.repo_root / "snapshots"

    @property
    def logs_dir(self) -> Path:
        return self.repo_root / "logs"

    def ensure_dirs(self) -> None:
        self.repo_root.mkdir(parents=True, exist_ok=True)
        self.parquet_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self.snapshots_dir.mkdir(parents=True, exist_ok=True)
