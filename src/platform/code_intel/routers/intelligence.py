from __future__ import annotations
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from code_intel.config import RepoPaths, DEFAULT_DATA_DIR
from code_intel.registry import registry
from code_intel.storage import Storage

router = APIRouter(prefix="/repos/{repo_id}/intelligence", tags=["intelligence"])

def _paths(repo_id: str, data_dir: str) -> RepoPaths:
    return RepoPaths(Path(data_dir), repo_id)

def _storage(repo_id: str, data_dir: str = "data") -> Storage:
    paths = _paths(repo_id, data_dir)
    return Storage(paths.db_path, paths.parquet_dir)

@router.get("/risk/overview")
async def get_risk_overview(repo_id: str, data_dir: str = "data"):
    try:
        paths = _paths(repo_id, data_dir)
        api = registry.get_api("intelligence")
        return api.get_risk_overview(paths.db_path)
    except ValueError:
        return {"overall_score": 0, "category_scores": {}, "high_risk_count": 0, "medium_risk_count": 0, "low_risk_count": 0}

@router.get("/risk/entities/{entity_id}")
async def get_entity_risk(repo_id: str, entity_id: int, data_dir: str = "data"):
    try:
        paths = _paths(repo_id, data_dir)
        api = registry.get_api("intelligence")
        return api.get_entity_risk(paths.db_path, entity_id)
    except ValueError:
        raise HTTPException(404, "Intelligence analyzer not available")

@router.get("/graph")
async def get_knowledge_graph(repo_id: str, data_dir: str = "data"):
    try:
        paths = _paths(repo_id, data_dir)
        api = registry.get_api("intelligence")
        return api.get_knowledge_graph(paths.db_path)
    except ValueError:
        return {"nodes": [], "edges": []}

@router.get("/dashboard")
async def get_intelligence_dashboard(repo_id: str, data_dir: str = "data"):
    """Aggregate data from all analyzers into a single dashboard view."""
    storage = _storage(repo_id, data_dir)
    try:
        # File count
        row = storage.conn.execute(
            "SELECT COUNT(*) FROM entities WHERE exists_at_head = 1 AND kind = 'file'"
        ).fetchone()
        total_files = row[0] if row else 0

        # Commit count from parquet
        commit_count = 0
        commits_path = storage.parquet_dir / "commits.parquet"
        if commits_path.exists():
            try:
                import pyarrow.dataset as ds
                commit_count = ds.dataset(commits_path).count_rows()
            except Exception:
                pass

        # Author count
        total_authors = 0
        if commits_path.exists():
            try:
                import pyarrow.dataset as ds
                table = ds.dataset(commits_path).to_table(columns=["author_email"])
                total_authors = table.to_pandas()["author_email"].nunique()
            except Exception:
                pass

        # Domain count
        domain_count = 0
        try:
            domain_count = storage.conn.execute(
                "SELECT COUNT(DISTINCT json_extract(metadata_json, '$.domain_id')) FROM entities WHERE metadata_json IS NOT NULL"
            ).fetchone()[0] or 0
        except Exception:
            pass

        # Risk overview
        overall_risk = 0.0
        try:
            row = storage.conn.execute(
                "SELECT AVG(CAST(json_extract(metadata_json, '$.risk_score') AS REAL)) FROM entities WHERE exists_at_head = 1 AND kind = 'file'"
            ).fetchone()
            overall_risk = round(row[0], 2) if row and row[0] else 0.0
        except Exception:
            pass

        # Analyzer statuses
        analyzers = []
        try:
            tasks = storage.conn.execute(
                """
                SELECT analyzer_type, state, finished_at
                FROM analysis_tasks
                ORDER BY created_at DESC
                """
            ).fetchall()
            seen = set()
            for t in tasks:
                if t[0] not in seen:
                    seen.add(t[0])
                    analyzers.append({
                        "type": t[0],
                        "name": t[0].replace("_", " ").title(),
                        "last_run": t[2],
                        "status": t[1],
                    })
        except Exception:
            pass

        # Top risks
        top_risks = []
        try:
            rows = storage.conn.execute(
                """
                SELECT qualified_name,
                       CAST(json_extract(metadata_json, '$.total_commits') AS INTEGER) as commits
                FROM entities
                WHERE exists_at_head = 1 AND kind = 'file'
                ORDER BY commits DESC
                LIMIT 10
                """
            ).fetchall()
            for r in rows:
                top_risks.append({
                    "path": r[0],
                    "risk_score": r[1] or 0,
                    "primary_signal": "high_churn",
                })
        except Exception:
            pass

        return {
            "summary": {
                "total_files": total_files,
                "total_commits": commit_count,
                "total_authors": total_authors,
                "total_domains": domain_count,
                "overall_risk": overall_risk,
            },
            "analyzers": analyzers,
            "top_risks": top_risks,
            "domain_overview": [],
            "trends": None,
        }
    finally:
        storage.close()


@router.get("/architecture")
async def get_architecture_map(repo_id: str, data_dir: str = "data"):
    """Cross-domain coupling map."""
    storage = _storage(repo_id, data_dir)
    try:
        # Get domains from semantic clustering if available
        domains = []
        cross_domain_coupling = []
        try:
            rows = storage.conn.execute(
                """
                SELECT DISTINCT 
                    json_extract(metadata_json, '$.domain_id') as domain_id,
                    json_extract(metadata_json, '$.domain_name') as domain_name
                FROM entities 
                WHERE metadata_json IS NOT NULL 
                  AND json_extract(metadata_json, '$.domain_id') IS NOT NULL
                """
            ).fetchall()
            for r in rows:
                file_count = storage.conn.execute(
                    "SELECT COUNT(*) FROM entities WHERE json_extract(metadata_json, '$.domain_id') = ?",
                    (r[0],),
                ).fetchone()[0]
                domains.append({
                    "domain_id": r[0],
                    "name": r[1] or f"Domain {r[0]}",
                    "file_count": file_count,
                    "dependencies": [],
                })
        except Exception:
            pass

        return {
            "domains": domains,
            "cross_domain_coupling": cross_domain_coupling,
        }
    finally:
        storage.close()


@router.get("/correlations")
async def get_correlations(
    repo_id: str,
    min_git_coupling: float = 0.1,
    min_semantic_similarity: float = 0.3,
    limit: int = 100,
    data_dir: str = "data",
):
    """Git/dep/semantic coupling correlation."""
    storage = _storage(repo_id, data_dir)
    try:
        file_pairs = []
        summary = {
            "total_pairs": 0,
            "aligned": 0,
            "structural_only": 0,
            "logical_only": 0,
            "conflicted": 0,
        }

        try:
            rows = storage.conn.execute(
                """
                SELECT e1.qualified_name, e2.qualified_name, g.jaccard
                FROM git_edges g
                JOIN entities e1 ON g.src_entity_id = e1.entity_id
                JOIN entities e2 ON g.dst_entity_id = e2.entity_id
                WHERE g.jaccard >= ?
                ORDER BY g.jaccard DESC
                LIMIT ?
                """,
                (min_git_coupling, limit),
            ).fetchall()

            for r in rows:
                file_pairs.append({
                    "file_a": r[0],
                    "file_b": r[1],
                    "git_coupling": r[2],
                    "dependency_coupling": False,
                    "semantic_similarity": 0.0,
                    "correlation_score": r[2],
                    "status": "logical_only",
                })
            summary["total_pairs"] = len(file_pairs)
            summary["logical_only"] = len(file_pairs)
        except Exception:
            pass

        return {"file_pairs": file_pairs, "summary": summary}
    finally:
        storage.close()
