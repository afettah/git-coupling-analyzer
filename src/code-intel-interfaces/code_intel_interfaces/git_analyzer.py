from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any


class GitAnalyzerAPI(ABC):
    """Query interface specific to git coupling analysis."""

    @abstractmethod
    def get_file_coupling(self, db_path: Path, file_path: str, *,
                          metric: str = "jaccard", min_weight: float = 0.0,
                          limit: int = 50) -> list[dict]:
        """Get files coupled with the given file."""
        ...

    @abstractmethod
    def get_coupling_graph(self, db_path: Path, root_path: str, *,
                           metric: str = "jaccard", min_weight: float = 0.1,
                           limit: int = 200) -> dict:
        """Get coupling graph (nodes + edges) for visualization."""
        ...

    @abstractmethod
    def get_file_history(self, db_path: Path, parquet_dir: Path,
                         file_path: str) -> dict:
        """Get commit history for a file."""
        ...

    @abstractmethod
    def get_file_details(self, db_path: Path, parquet_dir: Path,
                         file_path: str) -> dict:
        """Get comprehensive file details (commits, churn, authors)."""
        ...

    @abstractmethod
    def get_hotspots(self, db_path: Path, parquet_dir: Path, *,
                     limit: int = 50, sort_by: str = "risk_score") -> list[dict]:
        """Get files ranked by risk/churn/coupling."""
        ...

    @abstractmethod
    def get_dashboard_summary(self, db_path: Path, parquet_dir: Path) -> dict:
        """Summary stats for the dashboard."""
        ...

    @abstractmethod
    def get_component_coupling(self, db_path: Path, component: str, *,
                                depth: int = 2) -> list[dict]:
        """Get coupling between components/folders."""
        ...

    @abstractmethod
    def run_clustering(self, db_path: Path, *,
                       algorithm: str = "louvain", weight_column: str = "jaccard",
                       min_weight: float = 0.1, folders: list[str] | None = None,
                       params: dict | None = None) -> dict:
        """Run clustering algorithm on coupling graph."""
        ...

    @abstractmethod
    def get_file_tree(self, db_path: Path) -> dict:
        """Get file tree structure."""
        ...

    @abstractmethod
    def get_authors(self, db_path: Path, parquet_dir: Path, *,
                    limit: int = 50) -> list[dict]:
        """Get author statistics."""
        ...

    @abstractmethod
    def get_timeline(self, db_path: Path, parquet_dir: Path, *,
                     points: int = 12, granularity: str = "monthly") -> list[dict]:
        """Get temporal evolution data."""
        ...

    @abstractmethod
    def get_file_details_enhanced(self, db_path: Path, parquet_dir: Path,
                                   file_path: str) -> dict:
        """Get enhanced file details with risk factors, bus factor, knowledge silos."""
        ...

    @abstractmethod
    def get_file_activity_filtered(self, db_path: Path, parquet_dir: Path,
                                    file_path: str, *,
                                    from_ts: int | None = None,
                                    to_ts: int | None = None,
                                    granularity: str = "monthly") -> dict:
        """Get file activity with time-range filtering."""
        ...

    @abstractmethod
    def get_file_coupling_timeline(self, db_path: Path, parquet_dir: Path,
                                    file_path: str, *,
                                    from_ts: int | None = None,
                                    to_ts: int | None = None,
                                    granularity: str = "monthly") -> list[dict]:
        """Get coupling evolution timeline for a file."""
        ...

    @abstractmethod
    def get_file_risk_timeline(self, db_path: Path, parquet_dir: Path,
                                file_path: str, *,
                                from_ts: int | None = None,
                                to_ts: int | None = None,
                                granularity: str = "monthly") -> list[dict]:
        """Get risk score evolution timeline for a file."""
        ...

    @abstractmethod
    def get_file_authors_enhanced(self, db_path: Path, parquet_dir: Path,
                                   file_path: str, *,
                                   from_ts: int | None = None,
                                   to_ts: int | None = None,
                                   granularity: str = "monthly") -> dict:
        """Get enhanced file authors with bus factor and ownership timeline."""
        ...
