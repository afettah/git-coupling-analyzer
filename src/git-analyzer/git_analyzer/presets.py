"""Analysis presets and scan-driven recommendation helpers."""

from __future__ import annotations

from typing import Any


PRESETS: list[dict[str, Any]] = [
    {
        "id": "balanced",
        "label": "Balanced",
        "description": "Reliable default for most repositories.",
        "impact": "Balanced precision and runtime.",
        "config": {
            "skip_merge_commits": True,
            "max_changeset_size": 50,
            "min_cooccurrence": 3,
            "topk_edges_per_file": 50,
            "changeset_mode": "by_commit",
            "validation_mode": "soft",
        },
    },
    {
        "id": "quality",
        "label": "High Precision",
        "description": "Reduce noise and keep stronger coupling signals.",
        "impact": "Fewer but higher-confidence edges.",
        "config": {
            "skip_merge_commits": True,
            "max_changeset_size": 35,
            "min_revisions": 5,
            "min_cooccurrence": 5,
            "min_component_cooccurrence": 4,
            "topk_edges_per_file": 35,
            "validation_mode": "strict",
        },
    },
    {
        "id": "fast",
        "label": "Fast Feedback",
        "description": "Optimize for shorter iteration cycles.",
        "impact": "Faster runs with stronger filtering.",
        "config": {
            "skip_merge_commits": True,
            "max_changeset_size": 30,
            "max_logical_changeset_size": 60,
            "min_cooccurrence": 4,
            "topk_edges_per_file": 25,
            "max_validation_issues": 100,
        },
    },
    {
        "id": "explore",
        "label": "Exploratory",
        "description": "Capture broad and weak coupling for discovery.",
        "impact": "Richer graph with more noise and runtime.",
        "config": {
            "skip_merge_commits": False,
            "all_refs": True,
            "max_changeset_size": 80,
            "min_revisions": 2,
            "min_cooccurrence": 2,
            "topk_edges_per_file": 80,
            "validation_mode": "permissive",
        },
    },
    {
        "id": "deep",
        "label": "Deep Analyze",
        "description": "Include all history with minimal caps.",
        "impact": "Maximum recall with longest runtime.",
        "config": {
            "all_refs": True,
            "skip_merge_commits": False,
            "max_changeset_size": None,
            "max_logical_changeset_size": None,
            "topk_edges_per_file": None,
            "max_validation_issues": None,
            "min_revisions": 1,
            "min_cooccurrence": 1,
        },
    },
]


def list_presets() -> list[dict[str, Any]]:
    return [dict(item) for item in PRESETS]


def get_preset(preset_id: str) -> dict[str, Any] | None:
    for preset in PRESETS:
        if preset["id"] == preset_id:
            return dict(preset)
    return None


def suggest_preset(scan: dict[str, Any] | None) -> tuple[str, str]:
    if not scan:
        return "balanced", "No scan data yet; using balanced defaults."

    frameworks = {f.lower() for f in scan.get("frameworks", [])}
    commit_count = int(scan.get("commit_count") or scan.get("total_commits") or 0)
    total_files = int(scan.get("total_files") or 0)

    if total_files > 15000 or commit_count > 150000:
        return "fast", "Large repository detected; fast feedback preset is recommended."
    if "angular" in frameworks or "react" in frameworks or "nextjs" in frameworks:
        return "quality", "Framework-heavy repository detected; high precision preset is recommended."
    if commit_count < 500:
        return "explore", "Small history detected; exploratory preset can surface weak signals."

    return "balanced", "Balanced preset fits this repository profile."
