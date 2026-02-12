from __future__ import annotations
from pathlib import Path
from typing import Any
from datetime import datetime

from code_intel_interfaces.analyzer import BaseAnalyzer, AnalysisTask, TaskResult, TaskStatus
from git_analyzer.api import GitAPI
from git_analyzer.analysis_config import get_config_schema, normalize_config_dict

class GitPlugin(BaseAnalyzer):
    """Git coupling analyzer plugin."""

    @property
    def analyzer_type(self) -> str:
        return "git"

    @property
    def display_name(self) -> str:
        return "Git Coupling Analysis"

    def get_config_schema(self) -> dict:
        return get_config_schema()

    def analyze(self, task: AnalysisTask) -> TaskResult:
        """Run the full git analysis pipeline."""
        try:
            from git_analyzer.config import CouplingConfig
            from git_analyzer.runner import run_analysis
            from code_intel.config import RepoPaths
            
            # Reconstruct likely RepoPaths from db_path
            # db_path usually: .../data/repos/{repo_id}/lfca.sqlite
            repo_root = task.db_path.parent
            data_dir = repo_root.parent.parent
            paths = RepoPaths(data_dir, task.repo_id)
            
            # Ensure derived paths actually match task's expectations if they differ
            # But the caller (Orchestrator) likely constructs them consistently.
            
            # Filter and coerce config values through the config model.
            normalized = normalize_config_dict(task.config)
            config = CouplingConfig.from_dict(normalized)
            since = normalized.get("since")
            until = normalized.get("until")
            
            # Run
            result = run_analysis(
                paths=paths,
                run_id=task.task_id, 
                repo_path=task.repo_path,
                config=config,
                since=since,
                until=until
            )
            
            return TaskResult(
                task_id=task.task_id,
                status=TaskStatus.COMPLETED if result["state"] == "complete" else TaskStatus.FAILED,
                entity_count=result.get("file_count", 0),
                relationship_count=result.get("edge_count", 0),
                metrics=result,
                error=result.get("error")
            )
            
        except Exception as e:
            import traceback
            return TaskResult(
                task_id=task.task_id,
                status=TaskStatus.FAILED,
                error=f"{str(e)}\n{traceback.format_exc()}"
            )

    def validate_config(self, config: dict) -> list[str]:
        errors: list[str] = []

        def _to_int(name: str, minimum: int | None = None, maximum: int | None = None) -> None:
            if name not in config or config[name] is None:
                return
            try:
                value = int(config[name])
            except (TypeError, ValueError):
                errors.append(f"{name} must be an integer")
                return
            if minimum is not None and value < minimum:
                errors.append(f"{name} must be >= {minimum}")
            if maximum is not None and value > maximum:
                errors.append(f"{name} must be <= {maximum}")

        def _validate_date(name: str) -> str | None:
            value = config.get(name)
            if value is None:
                return None
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{name} must be a non-empty date string in YYYY-MM-DD format")
                return None
            try:
                datetime.fromisoformat(value)
                return value
            except ValueError:
                errors.append(f"{name} must be an ISO date (YYYY-MM-DD)")
                return None

        _to_int("max_changeset_size", minimum=2)
        _to_int("max_logical_changeset_size", minimum=2)
        _to_int("min_revisions", minimum=1)
        _to_int("min_cooccurrence", minimum=1)
        _to_int("author_time_window_hours", minimum=1)
        _to_int("topk_edges_per_file", minimum=1)
        _to_int("component_depth", minimum=1)
        _to_int("min_component_cooccurrence", minimum=1)
        _to_int("find_renames_threshold", minimum=1, maximum=100)
        _to_int("max_validation_issues", minimum=1)
        _to_int("window_days", minimum=1)
        _to_int("decay_half_life_days", minimum=1)
        _to_int("hotspot_threshold", minimum=1)

        mode = config.get("changeset_mode")
        if mode not in (None, "by_commit", "by_author_time", "by_ticket_id"):
            errors.append("changeset_mode must be one of: by_commit, by_author_time, by_ticket_id")
        if mode == "by_ticket_id" and not config.get("ticket_id_pattern"):
            errors.append("ticket_id_pattern is required when changeset_mode=by_ticket_id")

        validation_mode = config.get("validation_mode")
        if validation_mode not in (None, "strict", "soft", "permissive"):
            errors.append("validation_mode must be one of: strict, soft, permissive")

        since = _validate_date("since")
        until = _validate_date("until")
        if since and until and since > until:
            errors.append("since must be <= until")

        return errors

# Export for registration
plugin = GitPlugin()
api = GitAPI()
