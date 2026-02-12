"""Single source of truth for git analysis runtime configuration."""

from __future__ import annotations

from dataclasses import dataclass, field, fields
from typing import Any

from code_intel.config import ValidationMode


@dataclass
class GitAnalysisConfig:
    # Scope filters
    include_paths: list[str] = field(default_factory=list)
    exclude_paths: list[str] = field(default_factory=list)
    include_extensions: list[str] = field(default_factory=list)
    exclude_extensions: list[str] = field(default_factory=list)

    # Commit range
    since: str | None = None
    until: str | None = None
    window_days: int | None = None

    # Git history traversal
    ref: str = "HEAD"
    all_refs: bool = False
    skip_merge_commits: bool = True
    first_parent_only: bool = False
    find_renames_threshold: int = 60

    # Changeset grouping and filtering
    max_changeset_size: int | None = 50
    max_logical_changeset_size: int | None = 100
    min_revisions: int = 3
    min_cooccurrence: int = 3
    changeset_mode: str = "by_commit"
    author_time_window_hours: int = 24
    ticket_id_pattern: str | None = None

    # Coupling graph controls
    topk_edges_per_file: int | None = 50
    component_depth: int = 2
    min_component_cooccurrence: int = 3
    decay_half_life_days: int | None = None

    # Reporting/validation
    hotspot_threshold: int = 50
    validation_mode: str = "soft"
    max_validation_issues: int | None = 200

    def to_runtime_dict(self) -> dict[str, Any]:
        out = {f.name: getattr(self, f.name) for f in fields(self)}
        # Compat with CouplingConfig enum field.
        out["validation_mode"] = out.get("validation_mode") or ValidationMode.SOFT.value
        return out


FIELD_ORDER = [f.name for f in fields(GitAnalysisConfig)]

FIELD_SCHEMAS: dict[str, dict[str, Any]] = {
    "include_paths": {"type": "array", "items": {"type": "string"}, "default": [], "description": "Optional include path globs.", "x_group": "advanced"},
    "exclude_paths": {"type": "array", "items": {"type": "string"}, "default": [], "description": "Optional exclude path globs.", "x_group": "advanced"},
    "include_extensions": {"type": "array", "items": {"type": "string"}, "default": [], "description": "Optional include extensions.", "x_group": "advanced"},
    "exclude_extensions": {"type": "array", "items": {"type": "string"}, "default": [], "description": "Optional exclude extensions.", "x_group": "advanced"},
    "since": {"type": "string", "nullable": True, "description": "Lower commit date bound (YYYY-MM-DD).", "x_group": "important"},
    "until": {"type": "string", "nullable": True, "description": "Upper commit date bound (YYYY-MM-DD).", "x_group": "important"},
    "window_days": {"type": "integer", "nullable": True, "minimum": 1, "description": "Relative history window when since is unset.", "x_group": "advanced"},
    "ref": {"type": "string", "default": "HEAD", "description": "History traversal ref when all_refs=false.", "x_group": "advanced"},
    "all_refs": {"type": "boolean", "default": False, "description": "Include all refs in traversal.", "x_group": "advanced"},
    "skip_merge_commits": {"type": "boolean", "default": True, "description": "Exclude merge commits.", "x_group": "important"},
    "first_parent_only": {"type": "boolean", "default": False, "description": "Traverse first-parent lineage only.", "x_group": "advanced"},
    "find_renames_threshold": {"type": "integer", "default": 60, "minimum": 1, "maximum": 100, "description": "Git rename detection threshold.", "x_group": "advanced"},
    "max_changeset_size": {"type": "integer", "nullable": True, "default": 50, "minimum": 2, "description": "Max commit changeset size (null = include all).", "x_group": "important"},
    "max_logical_changeset_size": {"type": "integer", "nullable": True, "default": 100, "minimum": 2, "description": "Max grouped changeset size (null = include all).", "x_group": "advanced"},
    "min_revisions": {"type": "integer", "default": 3, "minimum": 1, "description": "Minimum file revisions before emitting edges.", "x_group": "advanced"},
    "min_cooccurrence": {"type": "integer", "default": 3, "minimum": 1, "description": "Minimum co-change count for file edges.", "x_group": "important"},
    "changeset_mode": {"type": "string", "enum": ["by_commit", "by_author_time", "by_ticket_id"], "default": "by_commit", "description": "Changeset grouping strategy.", "x_group": "important"},
    "author_time_window_hours": {"type": "integer", "default": 24, "minimum": 1, "description": "Window for by_author_time mode.", "x_group": "advanced"},
    "ticket_id_pattern": {"type": "string", "nullable": True, "description": "Regex for by_ticket_id mode.", "x_group": "advanced"},
    "topk_edges_per_file": {"type": "integer", "nullable": True, "default": 50, "minimum": 1, "description": "Keep top K edges per file (null = include all).", "x_group": "advanced"},
    "component_depth": {"type": "integer", "default": 2, "minimum": 1, "description": "Folder depth for component aggregation.", "x_group": "advanced"},
    "min_component_cooccurrence": {"type": "integer", "default": 3, "minimum": 1, "description": "Minimum component co-occurrence.", "x_group": "advanced"},
    "decay_half_life_days": {"type": "integer", "nullable": True, "minimum": 1, "description": "Exponential recency weighting half-life.", "x_group": "advanced"},
    "hotspot_threshold": {"type": "integer", "default": 50, "minimum": 1, "description": "Commit count threshold for hotspot classification.", "x_group": "advanced"},
    "validation_mode": {"type": "string", "enum": ["strict", "soft", "permissive"], "default": "soft", "description": "Parser strictness mode.", "x_group": "advanced"},
    "max_validation_issues": {"type": "integer", "nullable": True, "default": 200, "minimum": 1, "description": "Cap sampled validation issues (null = include all).", "x_group": "advanced"},
}


def default_config_dict() -> dict[str, Any]:
    return GitAnalysisConfig().to_runtime_dict()


def get_config_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {name: FIELD_SCHEMAS[name] for name in FIELD_ORDER},
    }


def normalize_config_dict(raw: dict[str, Any] | None) -> dict[str, Any]:
    merged = default_config_dict()
    if not raw:
        return merged

    for key in FIELD_ORDER:
        if key not in raw:
            continue
        value = raw[key]

        if key in {"include_paths", "exclude_paths", "include_extensions", "exclude_extensions"}:
            merged[key] = list(value) if isinstance(value, list) else []
            continue

        if key in {"since", "until", "ticket_id_pattern"}:
            if isinstance(value, str):
                value = value.strip()
            merged[key] = value or None
            continue

        if key in {"window_days", "decay_half_life_days"}:
            merged[key] = None if value in ("", None) else value
            continue

        if key in {"max_changeset_size", "max_logical_changeset_size", "topk_edges_per_file", "max_validation_issues"}:
            if value in ("", None):
                merged[key] = None
            else:
                try:
                    parsed = int(value)
                    merged[key] = parsed if parsed > 0 else None
                except (TypeError, ValueError):
                    pass
            continue

        merged[key] = value
    return merged
