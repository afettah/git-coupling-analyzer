"""Synchronize current file state with git HEAD."""

from __future__ import annotations
import subprocess
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
    storage.update_head_status(current_paths)
    return len(current_paths)


def build_file_tree(storage: Storage, include_stats: bool = True) -> dict:
    """Build hierarchical tree of current files with optional stats."""
    if include_stats:
        files = storage.get_current_files_with_stats()
    else:
        files = storage.get_current_files()
    
    tree = {}
    for f in files:
        path = f["path"]
        parts = path.split("/")
        
        node = tree
        for i, part in enumerate(parts[:-1]):
            if part not in node:
                node[part] = {"__type": "dir", "__children": {}}
            node = node[part]["__children"]
        
        # Leaf file with extended stats
        filename = parts[-1]
        file_node = {
            "__type": "file",
            "file_id": f["file_id"],
            "commits": f["total_commits"] or 0,
        }
        
        # Add extended stats if available
        if include_stats:
            file_node.update({
                "coupled_count": f.get("coupled_count", 0),
                "max_coupling": f.get("max_coupling", 0),
                "avg_coupling": f.get("avg_coupling", 0),
                "strong_coupling_count": f.get("strong_coupling_count", 0),
                "lines_added": f.get("lines_added", 0),
                "lines_deleted": f.get("lines_deleted", 0),
                "last_modified": f.get("last_modified"),
                "last_author": f.get("last_author"),
                "authors": f.get("authors", 0),
            })
        
        node[filename] = file_node
    
    return tree


def get_folder_list(storage: Storage, depth: int = 2) -> list[str]:
    """Get unique folder paths at given depth."""
    files = storage.get_current_files()
    
    folders = set()
    for f in files:
        parts = f["path"].split("/")
        if len(parts) > depth:
            folder = "/".join(parts[:depth])
            folders.add(folder)
    
    return sorted(folders)
