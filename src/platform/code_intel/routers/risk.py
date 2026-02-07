"""Risk analysis router — BUG #4 fix."""
from __future__ import annotations
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException

from code_intel.config import RepoPaths
from code_intel.storage import Storage

router = APIRouter(prefix="/repos/{repo_id}/risk", tags=["risk"])


def _storage(repo_id: str, data_dir: str = "data") -> Storage:
    paths = RepoPaths(Path(data_dir), repo_id)
    return Storage(paths.db_path, paths.parquet_dir)


@router.get("/overview")
async def get_risk_overview(repo_id: str, data_dir: str = "data"):
    """Aggregate risk scores from entities metadata."""
    storage = _storage(repo_id, data_dir)
    try:
        # Calculate overall risk based on churn metrics
        row = storage.conn.execute(
            """
            SELECT 
                AVG(CAST(json_extract(metadata_json, '$.total_commits') AS REAL)),
                MAX(CAST(json_extract(metadata_json, '$.total_commits') AS REAL))
            FROM entities 
            WHERE exists_at_head = 1 AND kind = 'file'
            """
        ).fetchone()

        overall_score = 0.0
        if row and row[1]:
            overall_score = round(min((row[0] or 0) / max(row[1], 1) * 100, 100), 1)

        # Count files by risk buckets
        rows = storage.conn.execute(
            """
            SELECT 
                CAST(json_extract(metadata_json, '$.total_commits') AS INTEGER) as commits
            FROM entities 
            WHERE exists_at_head = 1 AND kind = 'file'
            """
        ).fetchall()

        high_risk = 0
        medium_risk = 0
        low_risk = 0
        distribution = {"0-20": 0, "20-40": 0, "40-60": 0, "60-80": 0, "80-100": 0}

        max_commits = max((r[0] or 0 for r in rows), default=1) or 1
        for (commits_val,) in rows:
            c = commits_val or 0
            score = min(c / max_commits * 100, 100)
            if score >= 70:
                high_risk += 1
            elif score >= 40:
                medium_risk += 1
            else:
                low_risk += 1

            if score < 20:
                distribution["0-20"] += 1
            elif score < 40:
                distribution["20-40"] += 1
            elif score < 60:
                distribution["40-60"] += 1
            elif score < 80:
                distribution["60-80"] += 1
            else:
                distribution["80-100"] += 1

        # Get coupling risk
        coupling_row = storage.conn.execute(
            "SELECT AVG(jaccard) FROM git_edges"
        ).fetchone()
        coupling_score = round((coupling_row[0] or 0) * 100, 1) if coupling_row else 0.0

        return {
            "overall_score": overall_score,
            "category_scores": {
                "coupling": coupling_score,
                "dependency": 0.0,
                "churn": overall_score,
                "semantic": 0.0,
            },
            "high_risk_count": high_risk,
            "medium_risk_count": medium_risk,
            "low_risk_count": low_risk,
            "distribution": [
                {"bucket": k, "count": v} for k, v in distribution.items()
            ],
        }
    except Exception:
        return {
            "overall_score": 0,
            "category_scores": {"coupling": 0, "dependency": 0, "churn": 0, "semantic": 0},
            "high_risk_count": 0,
            "medium_risk_count": 0,
            "low_risk_count": 0,
            "distribution": [],
        }
    finally:
        storage.close()


@router.get("/files")
async def get_risk_files(
    repo_id: str,
    min_risk: float = 0.0,
    max_risk: float = 100.0,
    folder: str | None = None,
    sort_by: str = "overall_risk",
    order: str = "desc",
    limit: int = 100,
    offset: int = 0,
    data_dir: str = "data",
):
    """List files with risk scores, support filtering/sorting."""
    storage = _storage(repo_id, data_dir)
    try:
        where = "WHERE e.exists_at_head = 1 AND e.kind = 'file'"
        params: list = []
        if folder:
            where += " AND e.qualified_name LIKE ?"
            params.append(f"{folder}/%")

        rows = storage.conn.execute(
            f"""
            SELECT e.entity_id, e.qualified_name,
                   CAST(json_extract(e.metadata_json, '$.total_commits') AS INTEGER) as commits,
                   CAST(json_extract(e.metadata_json, '$.total_lines_added') AS INTEGER) as lines_added,
                   CAST(json_extract(e.metadata_json, '$.total_lines_deleted') AS INTEGER) as lines_deleted,
                   CAST(json_extract(e.metadata_json, '$.authors_count') AS INTEGER) as authors
            FROM entities e
            {where}
            """,
            params,
        ).fetchall()

        # Calculate max commits for normalization
        max_commits = max((r[2] or 0 for r in rows), default=1) or 1

        results = []
        for r in rows:
            commits = r[2] or 0
            churn_risk = round(min(commits / max_commits * 100, 100), 1)
            overall_risk = churn_risk  # Simplified — extend with coupling/dep/semantic

            if overall_risk < min_risk or overall_risk > max_risk:
                continue

            # Get coupling risk for this file
            coupling_row = storage.conn.execute(
                "SELECT AVG(jaccard) FROM git_edges WHERE src_entity_id = ? OR dst_entity_id = ?",
                (r[0], r[0]),
            ).fetchone()
            coupling_risk = round((coupling_row[0] or 0) * 100, 1) if coupling_row else 0.0

            results.append({
                "entity_id": r[0],
                "path": r[1],
                "overall_risk": overall_risk,
                "coupling_risk": coupling_risk,
                "dependency_risk": 0.0,
                "churn_risk": churn_risk,
                "semantic_risk": 0.0,
                "signals": [],
            })

        # Sort
        reverse = order == "desc"
        sort_key = sort_by if sort_by in ("overall_risk", "coupling_risk", "dependency_risk", "churn_risk") else "overall_risk"
        results.sort(key=lambda x: x.get(sort_key, 0), reverse=reverse)

        return results[offset: offset + limit]
    except Exception:
        return []
    finally:
        storage.close()


@router.get("/folders")
async def get_risk_folders(repo_id: str, data_dir: str = "data"):
    """Aggregate risk by folder."""
    storage = _storage(repo_id, data_dir)
    try:
        rows = storage.conn.execute(
            """
            SELECT e.qualified_name,
                   CAST(json_extract(e.metadata_json, '$.total_commits') AS INTEGER) as commits
            FROM entities e
            WHERE e.exists_at_head = 1 AND e.kind = 'file'
            """
        ).fetchall()

        max_commits = max((r[1] or 0 for r in rows), default=1) or 1
        folder_data: dict[str, dict] = {}

        for r in rows:
            path = r[0] or ""
            commits = r[1] or 0
            risk = min(commits / max_commits * 100, 100)

            # Get parent folder
            parts = path.rsplit("/", 1)
            folder = parts[0] if len(parts) > 1 else "."

            if folder not in folder_data:
                folder_data[folder] = {
                    "folder_path": folder,
                    "file_count": 0,
                    "total_risk": 0.0,
                    "max_risk": 0.0,
                    "high_risk_files": 0,
                }
            folder_data[folder]["file_count"] += 1
            folder_data[folder]["total_risk"] += risk
            folder_data[folder]["max_risk"] = max(folder_data[folder]["max_risk"], risk)
            if risk >= 70:
                folder_data[folder]["high_risk_files"] += 1

        results = []
        for fd in folder_data.values():
            avg_risk = round(fd["total_risk"] / max(fd["file_count"], 1), 1)
            results.append({
                "folder_path": fd["folder_path"],
                "file_count": fd["file_count"],
                "avg_risk": avg_risk,
                "max_risk": round(fd["max_risk"], 1),
                "high_risk_files": fd["high_risk_files"],
            })

        results.sort(key=lambda x: x["avg_risk"], reverse=True)
        return results
    except Exception:
        return []
    finally:
        storage.close()
