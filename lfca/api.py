from __future__ import annotations

import datetime
import json
import uuid
from pathlib import Path
from typing import Iterable, List

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from lfca.cluster import ClusterConfig, build_clusters, save_clusters
from lfca.config import RepoPaths
from lfca.edges import EdgeBuilder, EdgeConfig
from lfca.extract import ExtractConfig, HistoryExtractor
from lfca.git import count_commits
from lfca.mirror import mirror_repo
import pyarrow.parquet as pq
import pyarrow.dataset as ds

app = FastAPI(title="LFCA API")
_STATIC_DIR = Path(__file__).resolve().parent / "static"
if _STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static")


def _paths(repo_id: str, data_dir: str) -> RepoPaths:
    return RepoPaths(Path(data_dir), repo_id)


def _edges_for_file(edges_path: Path, file_id: int) -> Iterable[dict]:
    dataset = ds.dataset(edges_path)
    filter_expr = (ds.field("src_file_id") == file_id) | (ds.field("dst_file_id") == file_id)
    columns = [
        "src_file_id",
        "dst_file_id",
        "pair_count",
        "src_count",
        "dst_count",
        "weight_jaccard",
    ]
    for batch in dataset.to_batches(columns=columns, filter=filter_expr):
        src_ids = batch.column(batch.schema.get_field_index("src_file_id")).to_pylist()
        dst_ids = batch.column(batch.schema.get_field_index("dst_file_id")).to_pylist()
        pair_counts = batch.column(batch.schema.get_field_index("pair_count")).to_pylist()
        src_counts = batch.column(batch.schema.get_field_index("src_count")).to_pylist()
        dst_counts = batch.column(batch.schema.get_field_index("dst_count")).to_pylist()
        weights = batch.column(batch.schema.get_field_index("weight_jaccard")).to_pylist()
        for src, dst, pair_count, src_count, dst_count, weight in zip(
            src_ids, dst_ids, pair_counts, src_counts, dst_counts, weights
        ):
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


def _folder_at_depth(path: str, depth: int) -> str:
    if not path:
        return ""
    parts = path.split("/")
    if depth <= 0:
        return ""
    return "/".join(parts[:depth])


def _analysis_status_path(paths: RepoPaths) -> Path:
    return paths.runs_dir / "analysis_status.json"


def _cluster_status_path(paths: RepoPaths, run_id: str) -> Path:
    return paths.runs_dir / f"cluster_{run_id}_status.json"


def _cluster_results_path(paths: RepoPaths, run_id: str) -> Path:
    return paths.runs_dir / f"cluster_{run_id}.json"


def _write_status(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(".tmp")
    tmp_path.write_text(json.dumps(payload, indent=2))
    tmp_path.replace(path)


def _read_status(path: Path) -> dict | None:
    if not path.exists():
        return None
    return json.loads(path.read_text())


class AnalyzeRequest(BaseModel):
    repo_path: str
    since: str | None = None
    until: str | None = None
    max_files_per_commit: int = 300
    bulk_policy: str = "downweight"
    topk_edges_per_file: int = 50
    merge_policy: str = "include"
    merge_downweight: float = 0.5
    parallel_postprocessing: bool = False
    data_dir: str = "data"


class ClusterRequest(BaseModel):
    algorithm: str = "components"
    min_weight: float = Field(0.2, ge=0.0, le=1.0)
    folders: list[str] = Field(default_factory=list)
    data_dir: str = "data"


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


def _run_analysis_job(repo_id: str, request: AnalyzeRequest) -> None:
    paths = _paths(repo_id, request.data_dir)
    status_path = _analysis_status_path(paths)
    started_at = datetime.datetime.utcnow().isoformat()
    total_commits = count_commits(Path(request.repo_path), since=request.since, until=request.until)
    _write_status(
        status_path,
        {
            "state": "running",
            "stage": "extracting",
            "processed_commits": 0,
            "total_commits": total_commits,
            "progress": 0.0,
            "started_at": started_at,
            "updated_at": started_at,
        },
    )
    try:
        mirror_repo(Path(request.repo_path), paths)
        extractor = HistoryExtractor(
            Path(request.repo_path),
            paths,
            ExtractConfig(
                max_files_per_commit=request.max_files_per_commit,
                bulk_policy=request.bulk_policy,
                merge_policy=request.merge_policy,
                parallel_postprocessing=request.parallel_postprocessing,
            ),
        )

        def _update_progress(commit_count: int) -> None:
            progress = 1.0 if total_commits == 0 else min(commit_count / total_commits, 1.0)
            _write_status(
                status_path,
                {
                    "state": "running",
                    "stage": "extracting",
                    "processed_commits": commit_count,
                    "total_commits": total_commits,
                    "progress": progress,
                    "started_at": started_at,
                    "updated_at": datetime.datetime.utcnow().isoformat(),
                },
            )

        stats = extractor.run(since=request.since, until=request.until, progress_callback=_update_progress)

        _write_status(
            status_path,
            {
                "state": "running",
                "stage": "building_edges",
                "processed_commits": stats.commit_count,
                "total_commits": total_commits,
                "progress": 1.0 if total_commits == 0 else min(stats.commit_count / total_commits, 1.0),
                "started_at": started_at,
                "updated_at": datetime.datetime.utcnow().isoformat(),
            },
        )

        from lfca.cli import _iter_transactions_from_parquet

        transactions = _iter_transactions_from_parquet(
            paths, merge_policy=request.merge_policy, merge_downweight=request.merge_downweight
        )
        EdgeBuilder(
            paths,
            EdgeConfig(
                max_files_per_commit=request.max_files_per_commit,
                bulk_policy=request.bulk_policy,
                topk_edges_per_file=request.topk_edges_per_file,
                merge_policy=request.merge_policy,
                merge_downweight=request.merge_downweight,
            ),
        ).build(transactions)
        _write_status(
            status_path,
            {
                "state": "complete",
                "stage": "complete",
                "processed_commits": stats.commit_count,
                "total_commits": total_commits,
                "progress": 1.0,
                "commit_count": stats.commit_count,
                "change_count": stats.change_count,
                "transaction_count": stats.transaction_count,
                "started_at": started_at,
                "updated_at": datetime.datetime.utcnow().isoformat(),
            },
        )
    except Exception as exc:
        _write_status(
            status_path,
            {
                "state": "failed",
                "stage": "error",
                "processed_commits": 0,
                "total_commits": total_commits,
                "progress": 0.0,
                "error": str(exc),
                "started_at": started_at,
                "updated_at": datetime.datetime.utcnow().isoformat(),
            },
        )
        raise


@app.post("/repos/{repo_id}/analysis/start")
def start_analysis(repo_id: str, request: AnalyzeRequest, background_tasks: BackgroundTasks) -> dict:
    paths = _paths(repo_id, request.data_dir)
    status_path = _analysis_status_path(paths)
    status = _read_status(status_path)
    if status and status.get("state") == "running":
        raise HTTPException(status_code=409, detail="Analysis is already running.")
    background_tasks.add_task(_run_analysis_job, repo_id, request)
    return {"state": "queued"}


@app.get("/repos/{repo_id}/analysis/status")
def analysis_status(repo_id: str, data_dir: str = "data") -> dict:
    paths = _paths(repo_id, data_dir)
    status = _read_status(_analysis_status_path(paths))
    if not status:
        return {"state": "not_started"}
    return status


def _run_cluster_job(repo_id: str, run_id: str, request: ClusterRequest) -> None:
    paths = _paths(repo_id, request.data_dir)
    status_path = _cluster_status_path(paths, run_id)
    started_at = datetime.datetime.utcnow().isoformat()
    _write_status(
        status_path,
        {
            "state": "running",
            "stage": "clustering",
            "run_id": run_id,
            "started_at": started_at,
            "updated_at": started_at,
        },
    )
    try:
        config = ClusterConfig(
            algorithm=request.algorithm,
            min_weight=request.min_weight,
            folders=tuple(request.folders),
        )
        results = build_clusters(paths, config)
        results.update(
            {
                "run_id": run_id,
                "generated_at": datetime.datetime.utcnow().isoformat(),
            }
        )
        save_clusters(_cluster_results_path(paths, run_id), results)
        _write_status(
            status_path,
            {
                "state": "complete",
                "stage": "complete",
                "run_id": run_id,
                "cluster_count": results["cluster_count"],
                "started_at": started_at,
                "updated_at": datetime.datetime.utcnow().isoformat(),
            },
        )
    except Exception as exc:
        _write_status(
            status_path,
            {
                "state": "failed",
                "stage": "error",
                "run_id": run_id,
                "error": str(exc),
                "started_at": started_at,
                "updated_at": datetime.datetime.utcnow().isoformat(),
            },
        )
        raise


@app.post("/repos/{repo_id}/clusters/start")
def start_cluster(repo_id: str, request: ClusterRequest, background_tasks: BackgroundTasks) -> dict:
    paths = _paths(repo_id, request.data_dir)
    run_id = uuid.uuid4().hex[:10]
    background_tasks.add_task(_run_cluster_job, repo_id, run_id, request)
    _write_status(
        paths.runs_dir / "cluster_latest.json",
        {
            "run_id": run_id,
            "requested_at": datetime.datetime.utcnow().isoformat(),
        },
    )
    return {"state": "queued", "run_id": run_id}


@app.get("/repos/{repo_id}/clusters/{run_id}/status")
def cluster_status(repo_id: str, run_id: str, data_dir: str = "data") -> dict:
    paths = _paths(repo_id, data_dir)
    status = _read_status(_cluster_status_path(paths, run_id))
    if not status:
        return {"state": "not_started", "run_id": run_id}
    return status


@app.get("/repos/{repo_id}/clusters/{run_id}")
def cluster_results(repo_id: str, run_id: str, data_dir: str = "data") -> dict:
    paths = _paths(repo_id, data_dir)
    results_path = _cluster_results_path(paths, run_id)
    if not results_path.exists():
        raise HTTPException(status_code=404, detail="Cluster results not found.")
    return json.loads(results_path.read_text())


@app.get("/repos/{repo_id}/clusters/latest")
def cluster_latest(repo_id: str, data_dir: str = "data") -> dict:
    paths = _paths(repo_id, data_dir)
    latest_path = paths.runs_dir / "cluster_latest.json"
    if not latest_path.exists():
        raise HTTPException(status_code=404, detail="No cluster run found.")
    return json.loads(latest_path.read_text())


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


@app.get("/repos/{repo_id}/impact/folders")
def impact_folders(
    repo_id: str,
    path: str,
    top: int = 10,
    depth: int = 2,
    data_dir: str = "data",
) -> List[dict]:
    paths = _paths(repo_id, data_dir)
    index_path = paths.indexes_dir / "file_index.sqlite"
    edges_path = paths.edges_dir / "edges_file_topk.parquet"
    if not index_path.exists() or not edges_path.exists():
        raise HTTPException(status_code=404, detail="Required artifacts not found")

    file_id = _file_id_for_path(index_path, path)
    rows = list(_edges_for_file(edges_path, file_id))
    node_ids = {file_id}
    for row in rows:
        node_ids.add(row["src_file_id"])
        node_ids.add(row["dst_file_id"])
    paths_map = _paths_for_ids(index_path, node_ids)

    folder_totals: dict[str, dict[str, float]] = {}
    for row in rows:
        src_path = paths_map.get(row["src_file_id"], "")
        dst_path = paths_map.get(row["dst_file_id"], "")
        other_path = dst_path if row["src_file_id"] == file_id else src_path
        folder = _folder_at_depth(other_path, depth) or "(root)"
        entry = folder_totals.setdefault(folder, {"weight_total": 0.0, "edge_count": 0})
        entry["weight_total"] += float(row["weight_jaccard"])
        entry["edge_count"] += 1

    ranked = [
        {"folder": folder, "weight_total": data["weight_total"], "edge_count": data["edge_count"]}
        for folder, data in folder_totals.items()
    ]
    ranked.sort(key=lambda item: item["weight_total"], reverse=True)
    return ranked[:top]


@app.get("/repos/{repo_id}/files/{path:path}/lineage")
def file_lineage(repo_id: str, path: str, data_dir: str = "data") -> List[dict]:
    paths = _paths(repo_id, data_dir)
    index_path = paths.indexes_dir / "file_index.sqlite"
    lineage_path = paths.artifacts_root / "file_lineage.parquet"
    if not index_path.exists() or not lineage_path.exists():
        raise HTTPException(status_code=404, detail="Required artifacts not found")

    file_id = _file_id_for_path(index_path, path)
    dataset = ds.dataset(lineage_path)
    table = dataset.to_table(
        columns=["file_id", "path", "start_commit_oid", "end_commit_oid"],
        filter=ds.field("file_id") == file_id,
    )
    rows = table.to_pylist()
    rows.sort(key=lambda row: row.get("start_commit_oid") or "")
    return rows


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
