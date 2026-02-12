from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Query
from code_intel.config import RepoPaths, DEFAULT_DATA_DIR
from code_intel.storage import Storage
from code_intel.logging_utils import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/repos/{repo_id}/risk", tags=["risk"])


def _storage(repo_id: str, data_dir: str | None = None) -> Storage:
    paths = RepoPaths(Path(data_dir) if data_dir else DEFAULT_DATA_DIR, repo_id)
    return Storage(paths.db_path, paths.parquet_dir)


def _compute_file_risk(row) -> dict:
    metadata = json.loads(row["metadata_json"]) if row["metadata_json"] else {}
    total_commits = metadata.get("total_commits", 0) or 0
    lines_added = metadata.get("total_lines_added", 0) or 0
    lines_deleted = metadata.get("total_lines_deleted", 0) or 0
    churn = lines_added + lines_deleted

    churn_risk = min(total_commits / 100, 1.0) * 0.5 + min(churn / 10000, 1.0) * 0.5
    coupling_risk = 0.0
    dependency_risk = 0.0
    semantic_risk = 0.0
    overall_risk = round(churn_risk * 0.4 + coupling_risk * 0.3 + dependency_risk * 0.2 + semantic_risk * 0.1, 3)

    return {
        "entity_id": row["entity_id"],
        "path": row["qualified_name"],
        "overall_risk": overall_risk,
        "coupling_risk": round(coupling_risk, 3),
        "dependency_risk": round(dependency_risk, 3),
        "churn_risk": round(churn_risk, 3),
        "semantic_risk": round(semantic_risk, 3),
        "signals": [],
    }


@router.get("/overview")
async def get_risk_overview(repo_id: str, data_dir: str = Query(default=None)):
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        rows = storage.conn.execute(
            "SELECT entity_id, qualified_name, metadata_json FROM entities WHERE exists_at_head = 1 AND kind = 'file'"
        ).fetchall()

        scores = [_compute_file_risk(r) for r in rows]
        high = sum(1 for s in scores if s["overall_risk"] >= 0.7)
        medium = sum(1 for s in scores if 0.4 <= s["overall_risk"] < 0.7)
        low = sum(1 for s in scores if s["overall_risk"] < 0.4)
        overall = round(sum(s["overall_risk"] for s in scores) / max(len(scores), 1), 3)

        buckets = {"0-0.2": 0, "0.2-0.4": 0, "0.4-0.6": 0, "0.6-0.8": 0, "0.8-1.0": 0}
        for s in scores:
            r = s["overall_risk"]
            if r < 0.2:
                buckets["0-0.2"] += 1
            elif r < 0.4:
                buckets["0.2-0.4"] += 1
            elif r < 0.6:
                buckets["0.4-0.6"] += 1
            elif r < 0.8:
                buckets["0.6-0.8"] += 1
            else:
                buckets["0.8-1.0"] += 1

        return {
            "overall_score": overall,
            "category_scores": {
                "coupling": round(sum(s["coupling_risk"] for s in scores) / max(len(scores), 1), 3),
                "dependency": round(sum(s["dependency_risk"] for s in scores) / max(len(scores), 1), 3),
                "churn": round(sum(s["churn_risk"] for s in scores) / max(len(scores), 1), 3),
                "semantic": round(sum(s["semantic_risk"] for s in scores) / max(len(scores), 1), 3),
            },
            "high_risk_count": high,
            "medium_risk_count": medium,
            "low_risk_count": low,
            "distribution": [{"bucket": k, "count": v} for k, v in buckets.items()],
        }
    except Exception as e:
        logger.warning(f"Risk overview failed: {e}")
        return {
            "overall_score": 0,
            "category_scores": {"coupling": 0, "dependency": 0, "churn": 0, "semantic": 0},
            "high_risk_count": 0, "medium_risk_count": 0, "low_risk_count": 0,
            "distribution": [],
        }
    finally:
        storage.close()


@router.get("/files")
async def get_risk_files(
    repo_id: str,
    min_risk: float = 0.0,
    max_risk: float = 1.0,
    folder: str | None = None,
    sort_by: str = "overall_risk",
    order: str = "desc",
    limit: int = 100,
    offset: int = 0,
    data_dir: str = Query(default=None),
):
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        where = "WHERE exists_at_head = 1 AND kind = 'file'"
        params: list = []
        if folder:
            where += " AND qualified_name LIKE ?"
            params.append(f"{folder}/%")

        rows = storage.conn.execute(
            f"SELECT entity_id, qualified_name, metadata_json FROM entities {where}",
            params,
        ).fetchall()

        scores = [_compute_file_risk(r) for r in rows]
        scores = [s for s in scores if min_risk <= s["overall_risk"] <= max_risk]

        allowed_sort = {"overall_risk", "coupling_risk", "dependency_risk", "churn_risk"}
        key = sort_by if sort_by in allowed_sort else "overall_risk"
        scores.sort(key=lambda s: s[key], reverse=(order == "desc"))

        return scores[offset:offset + limit]
    except Exception as e:
        logger.warning(f"Risk files failed: {e}")
        return []
    finally:
        storage.close()


@router.get("/folders")
async def get_risk_folders(repo_id: str, data_dir: str = Query(default=None)):
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        rows = storage.conn.execute(
            "SELECT entity_id, qualified_name, metadata_json FROM entities WHERE exists_at_head = 1 AND kind = 'file'"
        ).fetchall()

        scores = [_compute_file_risk(r) for r in rows]
        folders: dict[str, list] = {}
        for s in scores:
            parts = s["path"].rsplit("/", 1)
            folder = parts[0] if len(parts) > 1 else "."
            folders.setdefault(folder, []).append(s)

        return [
            {
                "folder_path": folder,
                "file_count": len(files),
                "avg_risk": round(sum(f["overall_risk"] for f in files) / len(files), 3),
                "max_risk": round(max(f["overall_risk"] for f in files), 3),
                "high_risk_files": sum(1 for f in files if f["overall_risk"] >= 0.7),
            }
            for folder, files in sorted(folders.items())
        ]
    except Exception as e:
        logger.warning(f"Risk folders failed: {e}")
        return []
    finally:
        storage.close()
