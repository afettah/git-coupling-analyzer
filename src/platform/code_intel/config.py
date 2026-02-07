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
        return self.repo_root / "code-intel.sqlite"

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
