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
        file_node = {
            "__type": "file",
            "entity_id": f["entity_id"],
            "commits": metadata.get("total_commits", 0),
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
