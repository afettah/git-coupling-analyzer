from __future__ import annotations

from pathlib import Path
from typing import List

from fastapi import FastAPI, HTTPException

from lfca.config import RepoPaths
import pyarrow.parquet as pq

app = FastAPI(title="LFCA API")


def _paths(repo_id: str, data_dir: str) -> RepoPaths:
    return RepoPaths(Path(data_dir), repo_id)


@app.get("/repos/{repo_id}/folders/tree")
def folder_tree(repo_id: str, data_dir: str = "data") -> dict:
    paths = _paths(repo_id, data_dir)
    stats_path = paths.artifacts_root / "file_stats.parquet"
    if not stats_path.exists():
        raise HTTPException(status_code=404, detail="file_stats.parquet not found")
    table = pq.read_table(stats_path)
    paths_col = table.column("path_current").to_pylist()

    tree = {}
    for path in paths_col:
        if not path:
            continue
        parts = path.split("/")
        node = tree
        for part in parts:
            node = node.setdefault(part, {})
    return tree


@app.get("/repos/{repo_id}/impact")
def impact(repo_id: str, path: str, top: int = 20, data_dir: str = "data") -> List[dict]:
    paths = _paths(repo_id, data_dir)
    index_path = paths.indexes_dir / "file_index.sqlite"
    edges_path = paths.edges_dir / "edges_file_topk.parquet"
    if not index_path.exists() or not edges_path.exists():
        raise HTTPException(status_code=404, detail="Required artifacts not found")

    import sqlite3

    with sqlite3.connect(index_path) as conn:
        row = conn.execute("SELECT file_id FROM file_index WHERE path_current = ?", (path,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Path not found")
        file_id = int(row[0])

    table = pq.read_table(edges_path)
    df = table.to_pandas()
    subset = df[(df.src_file_id == file_id) | (df.dst_file_id == file_id)]
    subset = subset.sort_values("weight_jaccard", ascending=False).head(top)
    return subset.to_dict(orient="records")
