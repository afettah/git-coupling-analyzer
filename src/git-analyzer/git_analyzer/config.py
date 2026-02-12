"""Coupling analysis configuration.

NOTE: CouplingConfig and GitAnalysisConfig (in analysis_config.py) are duplicates.
This is intentional for now:
- GitAnalysisConfig: API-facing schema with JSON Schema metadata  
- CouplingConfig: Runtime config dataclass used by extractor/runner

Future work: Consider merging into a single source of truth (ISSUE 008).
"""

from __future__ import annotations
from dataclasses import dataclass, asdict
from dataclasses import field

from code_intel.config import ValidationMode


@dataclass
class CouplingConfig:
    """Global coupling analysis configuration."""
    # Scope filters
    include_paths: list[str] = field(default_factory=list)
    exclude_paths: list[str] = field(default_factory=list)
    include_extensions: list[str] = field(default_factory=list)
    exclude_extensions: list[str] = field(default_factory=list)
    
    # Commit-level filters
    min_revisions: int = 3
    max_changeset_size: int | None = 50
    
    # Changeset grouping
    changeset_mode: str = "by_commit"  # by_commit | by_author_time | by_ticket_id
    author_time_window_hours: int = 24
    ticket_id_pattern: str | None = None
    
    # Logical changeset filters
    max_logical_changeset_size: int | None = 100
    
    # File-level thresholds
    min_cooccurrence: int = 3
    
    # Component level
    component_depth: int = 2
    min_component_cooccurrence: int = 3
    
    # Time filters
    window_days: int | None = None
    decay_half_life_days: int | None = None

    # Git history traversal
    ref: str = "HEAD"
    all_refs: bool = False
    skip_merge_commits: bool = True
    first_parent_only: bool = False
    find_renames_threshold: int = 60

    # Dashboard-related output thresholds
    hotspot_threshold: int = 50
    
    # Edge computation
    topk_edges_per_file: int | None = 50
    
    # Validation settings
    validation_mode: ValidationMode = ValidationMode.SOFT
    max_validation_issues: int | None = 200  # None means include all
    
    def to_dict(self) -> dict:
        """Convert config to dict with proper serialization."""
        data = asdict(self)
        # Convert ValidationMode enum to value
        data["validation_mode"] = self.validation_mode.value
        return data
    
    @classmethod
    def from_dict(cls, data: dict) -> "CouplingConfig":
        filtered = {k: v for k, v in data.items() if k in cls.__dataclass_fields__}
        mode = filtered.get("validation_mode")
        if isinstance(mode, str):
            try:
                filtered["validation_mode"] = ValidationMode(mode)
            except ValueError:
                filtered["validation_mode"] = ValidationMode.SOFT

        integer_fields = {
            "min_revisions",
            "max_changeset_size",
            "author_time_window_hours",
            "max_logical_changeset_size",
            "min_cooccurrence",
            "component_depth",
            "min_component_cooccurrence",
            "window_days",
            "decay_half_life_days",
            "hotspot_threshold",
            "topk_edges_per_file",
            "find_renames_threshold",
            "max_validation_issues",
        }
        for field_name in integer_fields:
            if field_name not in filtered:
                continue
            value = filtered[field_name]
            if value is None:
                continue
            try:
                filtered[field_name] = int(value)
            except (TypeError, ValueError):
                filtered.pop(field_name, None)
        return cls(**filtered)
