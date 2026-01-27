from __future__ import annotations

from pathlib import Path
from typing import Iterable, List

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from lfca.config import RepoPaths
import pyarrow.parquet as pq

app = FastAPI(title="LFCA API")
_STATIC_DIR = Path(__file__).resolve().parent / "static"
if _STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static")


def _paths(repo_id: str, data_dir: str) -> RepoPaths:
    return RepoPaths(Path(data_dir), repo_id)


def _edges_for_file(edges_path: Path, file_id: int) -> Iterable[dict]:
    parquet = pq.ParquetFile(edges_path)
    for batch in parquet.iter_batches():
        src_ids = batch.column(batch.schema.get_field_index("src_file_id")).to_pylist()
        dst_ids = batch.column(batch.schema.get_field_index("dst_file_id")).to_pylist()
        pair_counts = batch.column(batch.schema.get_field_index("pair_count")).to_pylist()
        src_counts = batch.column(batch.schema.get_field_index("src_count")).to_pylist()
        dst_counts = batch.column(batch.schema.get_field_index("dst_count")).to_pylist()
        weights = batch.column(batch.schema.get_field_index("weight_jaccard")).to_pylist()
        for src, dst, pair_count, src_count, dst_count, weight in zip(
            src_ids, dst_ids, pair_counts, src_counts, dst_counts, weights
        ):
            if src == file_id or dst == file_id:
                yield {
                    "src_file_id": int(src),
                    "dst_file_id": int(dst),
                    "pair_count": float(pair_count),
                    "src_count": int(src_count),
                    "dst_count": int(dst_count),
                    "weight_jaccard": float(weight),
                }


def _file_id_for_path(index_path: Path, path: str) -> int:
    import sqlite3

    with sqlite3.connect(index_path) as conn:
        row = conn.execute("SELECT file_id FROM file_index WHERE path_current = ?", (path,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Path not found")
        return int(row[0])


def _paths_for_ids(index_path: Path, file_ids: Iterable[int]) -> dict[int, str]:
    import sqlite3

    file_ids_list = list(set(file_ids))
    if not file_ids_list:
        return {}
    placeholders = ",".join(["?"] * len(file_ids_list))
    query = f"SELECT file_id, path_current FROM file_index WHERE file_id IN ({placeholders})"
    with sqlite3.connect(index_path) as conn:
        rows = conn.execute(query, file_ids_list).fetchall()
    return {int(file_id): path for file_id, path in rows}


@app.get("/")
def index() -> FileResponse:
    if not _STATIC_DIR.exists():
        raise HTTPException(status_code=404, detail="Static frontend not found")
    return FileResponse(_STATIC_DIR / "index.html")


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


@app.get("/repos/{repo_id}/files")
def list_files(repo_id: str, q: str | None = None, limit: int = 200, data_dir: str = "data") -> List[str]:
    paths = _paths(repo_id, data_dir)
    index_path = paths.indexes_dir / "file_index.sqlite"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="file_index.sqlite not found")
    import sqlite3

    with sqlite3.connect(index_path) as conn:
        if q:
            rows = conn.execute(
                "SELECT path_current FROM file_index WHERE path_current LIKE ? ORDER BY path_current LIMIT ?",
                (f"{q}%", limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT path_current FROM file_index ORDER BY path_current LIMIT ?",
                (limit,),
            ).fetchall()
    return [row[0] for row in rows]


@app.get("/repos/{repo_id}/impact")
def impact(repo_id: str, path: str, top: int = 20, data_dir: str = "data") -> List[dict]:
    paths = _paths(repo_id, data_dir)
    index_path = paths.indexes_dir / "file_index.sqlite"
    edges_path = paths.edges_dir / "edges_file_topk.parquet"
    if not index_path.exists() or not edges_path.exists():
        raise HTTPException(status_code=404, detail="Required artifacts not found")

    file_id = _file_id_for_path(index_path, path)
    rows = list(_edges_for_file(edges_path, file_id))
    rows.sort(key=lambda row: row["weight_jaccard"], reverse=True)
    return rows[:top]


@app.get("/repos/{repo_id}/impact/graph")
def impact_graph(repo_id: str, path: str, top: int = 20, data_dir: str = "data") -> dict:
    paths = _paths(repo_id, data_dir)
    index_path = paths.indexes_dir / "file_index.sqlite"
    edges_path = paths.edges_dir / "edges_file_topk.parquet"
    if not index_path.exists() or not edges_path.exists():
        raise HTTPException(status_code=404, detail="Required artifacts not found")

    file_id = _file_id_for_path(index_path, path)
    rows = list(_edges_for_file(edges_path, file_id))
    rows.sort(key=lambda row: row["weight_jaccard"], reverse=True)
    rows = rows[:top]
    node_ids = {file_id}
    for row in rows:
        node_ids.add(row["src_file_id"])
        node_ids.add(row["dst_file_id"])
    paths_map = _paths_for_ids(index_path, node_ids)
    nodes = [
        {"id": node_id, "path": paths_map.get(node_id, f"file:{node_id}")}
        for node_id in sorted(node_ids)
    ]
    edges = [
        {
            "source": row["src_file_id"],
            "target": row["dst_file_id"],
            "weight": row["weight_jaccard"],
            "pair_count": row["pair_count"],
        }
        for row in rows
    ]
    return {"nodes": nodes, "edges": edges, "focus_id": file_id}
