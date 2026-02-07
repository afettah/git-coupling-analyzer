from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any


class AnalyzerType(str, Enum):
    """Known analyzer types. Extensible via string values."""
    GIT_COUPLING = "git"
    DEPENDENCY = "deps"
    SEMANTIC = "semantic"
    INTELLIGENCE = "intelligence"


class TaskStatus(str, Enum):
    NOT_RUN = "not_run"
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class AnalysisTask:
    """A unit of work dispatched to an analyzer."""
    task_id: str
    analyzer_type: str
    repo_id: str
    repo_path: Path          # path to mirror.git or source repo
    db_path: Path            # path to the shared SQLite database
    parquet_dir: Path        # path to parquet data directory
    config: dict[str, Any]   # analyzer-specific configuration


@dataclass
class TaskResult:
    """Standard result from any analyzer task."""
    task_id: str
    status: TaskStatus
    entity_count: int = 0
    relationship_count: int = 0
    metrics: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


class BaseAnalyzer(ABC):
    """
    Contract that every analyzer must implement.

    The orchestrator:
    1. Calls list_capabilities() to discover what this analyzer offers
    2. Calls analyze() to run analysis (async-friendly, status tracked in DB)
    3. Calls the analyzer-specific query interface for data retrieval
    """

    @property
    @abstractmethod
    def analyzer_type(self) -> str:
        """Unique identifier: 'git', 'deps', 'semantic', etc."""
        ...

    @property
    @abstractmethod
    def display_name(self) -> str:
        """Human-readable name for UI."""
        ...

    @abstractmethod
    def get_config_schema(self) -> dict:
        """JSON Schema for this analyzer's configuration."""
        ...

    @abstractmethod
    def analyze(self, task: AnalysisTask) -> TaskResult:
        """
        Run analysis. This is the main entry point.

        SYNC tasks: Return TaskResult directly with data.
        ASYNC tasks: Update status in DB, return TaskResult with status=RUNNING,
                     complete work in background.

        The analyzer writes entities and relationships to the shared DB
        using the standard schema.
        """
        ...

    def validate_config(self, config: dict) -> list[str]:
        """Validate configuration. Return list of error messages (empty = valid)."""
        return []
