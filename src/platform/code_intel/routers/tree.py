from __future__ import annotations

from dataclasses import dataclass, field
from fnmatch import fnmatch
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from code_intel.config import RepoPaths, DEFAULT_DATA_DIR
from code_intel.storage import Storage

router = APIRouter(prefix="/repos/{repo_id}", tags=["tree"])


def _storage(repo_id: str, data_dir: str = Query(default=None)) -> Storage:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    paths = RepoPaths(Path(data_dir), repo_id)
    return Storage(paths.db_path, paths.parquet_dir)


class TreeNode(BaseModel):
    path: str
    name: str
    kind: Literal["file", "dir"]
    status: Literal["included", "excluded", "partial"] | None = None
    extension: str | None = None
    language: str | None = None
    children: list["TreeNode"] = Field(default_factory=list)


class TreePreviewRequest(BaseModel):
    include_patterns: list[str] = Field(default_factory=list)
    exclude_patterns: list[str] = Field(default_factory=list)
    extensions_include: list[str] = Field(default_factory=list)
    extensions_exclude: list[str] = Field(default_factory=list)
    max_depth: int = 10


@dataclass
class _Node:
    path: str
    name: str
    kind: str
    extension: str | None = None
    language: str | None = None
    parent_path: str | None = None
    children: list["_Node"] = field(default_factory=list)
    status: str | None = None


TreeNode.model_rebuild()


def _build_tree(rows: list[dict], root_path: str = "") -> list[_Node]:
    by_path: dict[str, _Node] = {}
    for row in rows:
        by_path[row["path"]] = _Node(
            path=row["path"],
            name=row.get("name") or Path(row["path"]).name or row["path"],
            kind="dir" if row["node_type"] == "directory" else "file",
            extension=row.get("extension"),
            language=row.get("language"),
            parent_path=row.get("parent_path"),
        )

    roots: list[_Node] = []
    for node in by_path.values():
        parent = by_path.get(node.parent_path or "")
        if parent:
            parent.children.append(node)
        else:
            roots.append(node)

    for node in by_path.values():
        node.children.sort(key=lambda c: (c.kind != "dir", c.path))

    if not root_path:
        return sorted(roots, key=lambda n: (n.kind != "dir", n.path))

    root = by_path.get(root_path)
    if root:
        return [root]

    return [
        node
        for node in sorted(roots, key=lambda n: (n.kind != "dir", n.path))
        if node.path.startswith(root_path)
    ]


def _to_response(nodes: list[_Node]) -> list[TreeNode]:
    def _convert(node: _Node) -> TreeNode:
        return TreeNode(
            path=node.path,
            name=node.name,
            kind=node.kind,
            status=node.status,
            extension=node.extension,
            language=node.language,
            children=[_convert(child) for child in node.children],
        )

    return [_convert(node) for node in nodes]


def _status_for_file(row: dict, request: TreePreviewRequest) -> str:
    path = row["path"]
    extension = (row.get("extension") or "").lower()

    if request.extensions_exclude and extension in {e.lower() for e in request.extensions_exclude}:
        return "excluded"
    if request.exclude_patterns and any(fnmatch(path, pattern) for pattern in request.exclude_patterns):
        return "excluded"

    include_match = True
    if request.extensions_include:
        include_match = extension in {e.lower() for e in request.extensions_include}
    if include_match and request.include_patterns:
        include_match = any(fnmatch(path, pattern) for pattern in request.include_patterns)

    return "included" if include_match else "excluded"


def _assign_directory_status(node: _Node) -> str:
    if node.kind == "file":
        return node.status or "excluded"
    child_states = {_assign_directory_status(child) for child in node.children}
    if not child_states:
        node.status = "excluded"
    elif child_states == {"included"}:
        node.status = "included"
    elif child_states == {"excluded"}:
        node.status = "excluded"
    else:
        node.status = "partial"
    return node.status


@router.get("/tree", response_model=list[TreeNode])
def get_tree(
    repo_id: str,
    path: str = Query("", description="Root path"),
    depth: int = Query(10, ge=0, le=64),
    include_files: bool = Query(True),
    data_dir: str = Query(default=None),
) -> list[TreeNode]:
    storage = _storage(repo_id, data_dir)
    try:
        rows = storage.fetch_tree_rows_for_preview(repo_id=repo_id, max_depth=depth)
        if not rows:
            return []
        if not include_files:
            rows = [row for row in rows if row["node_type"] == "directory"]
        tree = _build_tree(rows, root_path=path)
        return _to_response(tree)
    finally:
        storage.close()


@router.post("/tree/preview", response_model=list[TreeNode])
def preview_tree(
    repo_id: str,
    request: TreePreviewRequest,
    data_dir: str = Query(default=None),
) -> list[TreeNode]:
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        rows = storage.fetch_tree_rows_for_preview(repo_id=repo_id, max_depth=request.max_depth)
        if not rows:
            raise HTTPException(status_code=404, detail="No scan data available for tree preview")

        tree = _build_tree(rows)
        node_index = {node.path: node for node in _iter_nodes(tree)}

        for row in rows:
            if row["node_type"] == "file":
                status = _status_for_file(row, request)
                node = node_index.get(row["path"])
                if node:
                    node.status = status

        for root in tree:
            _assign_directory_status(root)

        return _to_response(tree)
    finally:
        storage.close()


def _iter_nodes(nodes: list[_Node]):
    for node in nodes:
        yield node
        if node.children:
            yield from _iter_nodes(node.children)
