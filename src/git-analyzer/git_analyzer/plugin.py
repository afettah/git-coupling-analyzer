from __future__ import annotations
from pathlib import Path
from typing import Any

from code_intel_interfaces.analyzer import BaseAnalyzer, AnalysisTask, TaskResult, TaskStatus
from git_analyzer.api import GitAPI
# from git_analyzer.runner import analyze_repo  # Assuming this exists or will be adapted

class GitPlugin(BaseAnalyzer):
    """Git coupling analyzer plugin."""

    @property
    def analyzer_type(self) -> str:
        return "git"

    @property
    def display_name(self) -> str:
        return "Git Coupling Analysis"

    def get_config_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "min_revisions": {"type": "integer", "default": 5},
                "max_changeset_size": {"type": "integer", "default": 50},
                "changeset_mode": {
                    "type": "string",
                    "enum": ["by_commit", "by_author_time", "by_ticket_id"],
                },
                "min_cooccurrence": {"type": "integer", "default": 5},
                "window_days": {"type": "integer", "nullable": True},
                "since": {"type": "string", "nullable": True},
                "until": {"type": "string", "nullable": True},
            }
        }

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
            
            # Filter config
            filtered_config = {k: v for k, v in task.config.items() 
                             if k in CouplingConfig.__dataclass_fields__}
            config = CouplingConfig(**filtered_config)
            
            since = task.config.get("since")
            until = task.config.get("until")
            
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
        return []

# Export for registration
plugin = GitPlugin()
api = GitAPI()
