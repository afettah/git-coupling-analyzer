from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


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
    def artifacts_root(self) -> Path:
        return self.repo_root / "artifacts" / "v1"

    @property
    def edges_dir(self) -> Path:
        return self.artifacts_root / "edges"

    @property
    def rules_dir(self) -> Path:
        return self.artifacts_root / "rules"

    @property
    def indexes_dir(self) -> Path:
        return self.artifacts_root / "indexes"

    @property
    def runs_dir(self) -> Path:
        return self.artifacts_root / "runs"

    def ensure_dirs(self) -> None:
        self.repo_root.mkdir(parents=True, exist_ok=True)
        self.artifacts_root.mkdir(parents=True, exist_ok=True)
        self.edges_dir.mkdir(parents=True, exist_ok=True)
        self.rules_dir.mkdir(parents=True, exist_ok=True)
        self.indexes_dir.mkdir(parents=True, exist_ok=True)
        self.runs_dir.mkdir(parents=True, exist_ok=True)
