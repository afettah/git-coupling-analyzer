"""Project scanner for extracting repository intelligence."""

from __future__ import annotations

import subprocess
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Set


@dataclass
class ScanResult:
    """Persisted scan snapshot."""

    scan_id: str
    repo_id: str
    repo_path: str
    commit_oid: str | None
    branch_name: str | None
    total_files: int
    total_dirs: int
    commit_count: int
    unique_authors: int
    first_commit_ts: int | None
    last_commit_ts: int | None
    first_commit_date: str | None
    last_commit_date: str | None
    extensions: Dict[str, int]
    languages: Dict[str, int]
    frameworks: List[str]
    tree_nodes: List[Dict]
    metadata: Dict


class ProjectScanner:
    """Scanner for extracting project intelligence from git repositories."""

    _GIT_TIMEOUT_SECONDS = 30
    _MAX_GIT_ATTEMPTS = 3

    LANGUAGE_MAP = {
        ".py": "python",
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".java": "java",
        ".cs": "csharp",
        ".go": "go",
        ".rs": "rust",
        ".rb": "ruby",
        ".php": "php",
        ".cpp": "cpp",
        ".cc": "cpp",
        ".c": "c",
        ".h": "c",
        ".hpp": "cpp",
        ".swift": "swift",
        ".kt": "kotlin",
        ".scala": "scala",
        ".vue": "vue",
        ".html": "html",
        ".css": "css",
        ".scss": "scss",
        ".sass": "sass",
        ".less": "less",
    }

    FRAMEWORK_MARKERS = {
        "package.json": ["node", "javascript"],
        "requirements.txt": ["python"],
        "pipfile": ["python"],
        "pyproject.toml": ["python"],
        "cargo.toml": ["rust"],
        "go.mod": ["go"],
        "build.gradle": ["java", "gradle"],
        "pom.xml": ["java", "maven"],
        ".csproj": ["dotnet"],
        ".sln": ["dotnet"],
        "gemfile": ["ruby"],
        "composer.json": ["php"],
        "next.config.js": ["nextjs", "react"],
        "nuxt.config.js": ["nuxtjs", "vue"],
        "angular.json": ["angular"],
        "vue.config.js": ["vue"],
        "tsconfig.json": ["typescript"],
        "webpack.config.js": ["webpack"],
        "vite.config.js": ["vite"],
        "dockerfile": ["docker"],
        "docker-compose.yml": ["docker"],
    }

    def __init__(self, repo_path: Path):
        self.repo_path = Path(repo_path)
        if not self.repo_path.exists():
            raise ValueError(f"Repository path does not exist: {repo_path}")

    def _run_git(self, *args: str) -> str:
        cmd = ["git", "-C", str(self.repo_path), *args]
        for attempt in range(self._MAX_GIT_ATTEMPTS):
            try:
                proc = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    check=True,
                    timeout=self._GIT_TIMEOUT_SECONDS,
                )
                return proc.stdout.strip()
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
                if attempt >= self._MAX_GIT_ATTEMPTS - 1:
                    return ""
                time.sleep(0.15 * (attempt + 1))
        return ""

    def scan(self, repo_id: str, storage=None) -> ScanResult:
        """Perform a complete project scan and optionally persist it."""
        scan_id = f"scan_{uuid.uuid4().hex}"
        commit_oid = self._run_git("rev-parse", "HEAD") or None
        branch_name = self._run_git("rev-parse", "--abbrev-ref", "HEAD") or None

        files_output = self._run_git("ls-tree", "-r", "--name-only", "HEAD")
        file_paths = [line.strip() for line in files_output.splitlines() if line.strip()]
        total_files = len(file_paths)

        commit_count_str = self._run_git("rev-list", "--count", "HEAD")
        commit_count = int(commit_count_str) if commit_count_str else 0

        authors_output = self._run_git("log", "--format=%ae")
        unique_authors = len({line for line in authors_output.splitlines() if line.strip()}) if authors_output else 0

        first_commit_ts = None
        last_commit_ts = None
        first_commit_log = self._run_git("log", "--reverse", "--format=%at", "HEAD")
        first_commit_str = first_commit_log.splitlines()[0] if first_commit_log else ""
        if first_commit_str:
            first_commit_ts = int(first_commit_str)
        last_commit_str = self._run_git("log", "--format=%at", "-1", "HEAD")
        if last_commit_str:
            last_commit_ts = int(last_commit_str)

        first_commit_date = (
            datetime.fromtimestamp(first_commit_ts, tz=timezone.utc).date().isoformat()
            if first_commit_ts
            else None
        )
        last_commit_date = (
            datetime.fromtimestamp(last_commit_ts, tz=timezone.utc).date().isoformat()
            if last_commit_ts
            else None
        )

        extensions: Dict[str, int] = {}
        languages: Dict[str, int] = {}
        frameworks: Set[str] = set()
        tree_nodes: List[Dict] = []
        directories: Set[str] = set()

        for file_path in file_paths:
            path = Path(file_path)
            extension = path.suffix.lower() if path.suffix else ""
            if extension:
                extensions[extension] = extensions.get(extension, 0) + 1

            language = self.LANGUAGE_MAP.get(extension)
            if language:
                languages[language] = languages.get(language, 0) + 1

            filename = path.name.lower()
            for marker, marker_frameworks in self.FRAMEWORK_MARKERS.items():
                if filename == marker or filename.endswith(marker):
                    frameworks.update(marker_frameworks)

            depth = len(path.parts)
            parent_path = str(path.parent) if path.parent != Path(".") else None
            tree_nodes.append(
                {
                    "path": str(path),
                    "name": path.name,
                    "node_type": "file",
                    "extension": extension or None,
                    "language": language,
                    "size_bytes": None,
                    "depth": depth,
                    "parent_path": parent_path,
                }
            )

            for i in range(1, len(path.parts)):
                directories.add(str(Path(*path.parts[:i])))

        for dir_path in sorted(directories):
            path = Path(dir_path)
            depth = len(path.parts)
            parent_path = str(path.parent) if path.parent != Path(".") else None
            tree_nodes.append(
                {
                    "path": str(path),
                    "name": path.name,
                    "node_type": "directory",
                    "extension": None,
                    "language": None,
                    "size_bytes": None,
                    "depth": depth,
                    "parent_path": parent_path,
                }
            )

        result = ScanResult(
            scan_id=scan_id,
            repo_id=repo_id,
            repo_path=str(self.repo_path),
            commit_oid=commit_oid,
            branch_name=branch_name,
            total_files=total_files,
            total_dirs=len(directories),
            commit_count=commit_count,
            unique_authors=unique_authors,
            first_commit_ts=first_commit_ts,
            last_commit_ts=last_commit_ts,
            first_commit_date=first_commit_date,
            last_commit_date=last_commit_date,
            extensions=extensions,
            languages=languages,
            frameworks=sorted(frameworks),
            tree_nodes=tree_nodes,
            metadata={"scanned_at": datetime.now(timezone.utc).isoformat()},
        )

        if storage:
            with storage.transaction():
                storage.save_project_scan(
                    {
                        "scan_id": result.scan_id,
                        "repo_id": result.repo_id,
                        "repo_path": result.repo_path,
                        "commit_oid": result.commit_oid,
                        "branch_name": result.branch_name,
                        "total_files": result.total_files,
                        "total_dirs": result.total_dirs,
                        "commit_count": result.commit_count,
                        "unique_authors": result.unique_authors,
                        "first_commit_ts": result.first_commit_ts,
                        "last_commit_ts": result.last_commit_ts,
                        "first_commit_date": result.first_commit_date,
                        "last_commit_date": result.last_commit_date,
                        "extensions": result.extensions,
                        "languages": result.languages,
                        "frameworks": result.frameworks,
                        "metadata": result.metadata,
                    }
                )
                storage.replace_project_tree(result.scan_id, result.tree_nodes, repo_id=result.repo_id)

        return result
