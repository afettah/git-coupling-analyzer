"""Synchronize current file state with git HEAD."""

from __future__ import annotations
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from code_intel.config import RepoPaths
from code_intel.storage import Storage


def get_files_at_head(mirror_path: Path) -> set[str]:
    """Get list of files at HEAD from git."""
    result = subprocess.run(
        ["git", "-C", str(mirror_path), "ls-tree", "-r", "--name-only", "HEAD"],
        capture_output=True,
        text=True,
        check=True
    )
    return set(line for line in result.stdout.strip().split('\n') if line)


def sync_head_files(paths: RepoPaths, storage: Storage) -> int:
    """
    Sync database with current HEAD state.
    Returns count of current files.
    """
    current_paths = get_files_at_head(paths.mirror_path)
    storage.update_head_status_bulk(kind="file", current_qualified_names=current_paths)
    return len(current_paths)


def build_file_tree(storage: Storage, include_stats: bool = True) -> dict:
    """Build hierarchical tree of current files with optional stats."""
    files = storage.get_entities_at_head(kind="file")
    
    tree = {}
    for f in files:
        path = f["qualified_name"]
        parts = path.split("/")
        
        node = tree
        for i, part in enumerate(parts[:-1]):
            if part not in node:
                node[part] = {"__type": "dir", "__children": {}}
            node = node[part]["__children"]
        
        # Leaf file 
        filename = parts[-1]
        metadata = f.get("metadata", {})
        last_commit_ts = metadata.get("last_commit_ts")
        last_modified = None
        if isinstance(last_commit_ts, (int, float)):
            last_modified = datetime.fromtimestamp(last_commit_ts, tz=timezone.utc).isoformat()

        file_node = {
            "__type": "file",
            "entity_id": f["entity_id"],
            "file_id": f["entity_id"],
            "commits": int(metadata.get("total_commits", 0) or 0),
            "total_commits": int(metadata.get("total_commits", 0) or 0),
            "first_commit_ts": metadata.get("first_commit_ts"),
            "last_commit_ts": last_commit_ts,
            "last_modified": last_modified,
            "commits_30d": int(metadata.get("commits_30d", 0) or 0),
            "commits_90d": int(metadata.get("commits_90d", 0) or 0),
            "lifetime_commits_per_month": float(metadata.get("lifetime_commits_per_month", 0.0) or 0.0),
            "days_since_last_change": metadata.get("days_since_last_change"),
            "is_hot": bool(metadata.get("is_hot", False)),
            "is_stable": bool(metadata.get("is_stable", False)),
            "is_unknown": bool(metadata.get("is_unknown", True)),
        }
        
        node[filename] = file_node
    
    return tree


def get_folder_list(storage: Storage, depth: int = 2) -> list[str]:
    """Get unique folder paths at given depth."""
    files = storage.get_entities_at_head(kind="file")
    
    folders = set()
    for f in files:
        path = f["qualified_name"]
        parts = path.split("/")
        if len(parts) > depth:
            folder = "/".join(parts[:depth])
            folders.add(folder)
    
    return sorted(folders)
