from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Query
from code_intel.config import RepoPaths, DEFAULT_DATA_DIR
from code_intel.registry import registry
from code_intel.storage import Storage
from code_intel.logging_utils import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/repos/{repo_id}/intelligence", tags=["intelligence"])


def _paths(repo_id: str, data_dir: str) -> RepoPaths:
    return RepoPaths(Path(data_dir), repo_id)


def _storage(repo_id: str, data_dir: str) -> Storage:
    paths = RepoPaths(Path(data_dir), repo_id)
    return Storage(paths.db_path, paths.parquet_dir)


@router.get("/risk/overview")
async def get_risk_overview(repo_id: str, data_dir: str = Query(default=None)):
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    paths = _paths(repo_id, data_dir)
    api = registry.get_api("intelligence")
    return api.get_risk_overview(paths.db_path)


@router.get("/risk/entities/{entity_id}")
async def get_entity_risk(repo_id: str, entity_id: int, data_dir: str = Query(default=None)):
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    paths = _paths(repo_id, data_dir)
    api = registry.get_api("intelligence")
    return api.get_entity_risk(paths.db_path, entity_id)


@router.get("/graph")
async def get_knowledge_graph(repo_id: str, data_dir: str = Query(default=None)):
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    paths = _paths(repo_id, data_dir)
    api = registry.get_api("intelligence")
    return api.get_knowledge_graph(paths.db_path)


@router.get("/dashboard")
async def get_intelligence_dashboard(repo_id: str, data_dir: str = Query(default=None)):
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        file_count = storage.conn.execute(
            "SELECT COUNT(*) FROM entities WHERE exists_at_head = 1 AND kind = 'file'"
        ).fetchone()[0]

        commit_count = 0
        author_count = 0
        try:
            import pyarrow.dataset as ds
            paths = _paths(repo_id, data_dir)
            commits_path = paths.parquet_dir / "commits.parquet"
            if commits_path.exists():
                dataset = ds.dataset(commits_path)
                commit_count = dataset.count_rows()
                table = dataset.to_table(columns=["author_email"])
                author_count = table.to_pandas()["author_email"].nunique()
        except Exception:
            pass

        domain_count = storage.conn.execute(
            "SELECT COUNT(DISTINCT dst_entity_id) FROM relationships WHERE source_type = 'semantic' AND rel_kind = 'BELONGS_TO_DOMAIN'"
        ).fetchone()[0]

        risk_row = storage.conn.execute(
            "SELECT AVG(jaccard) FROM git_edges"
        ).fetchone()
        overall_risk = round(risk_row[0] * 100, 1) if risk_row and risk_row[0] else 0.0

        task_rows = storage.conn.execute(
            "SELECT analyzer_type, state, finished_at FROM analysis_tasks ORDER BY created_at DESC"
        ).fetchall()
        analyzers = []
        seen_types: set[str] = set()
        for t in task_rows:
            if t["analyzer_type"] not in seen_types:
                seen_types.add(t["analyzer_type"])
                analyzers.append({
                    "type": t["analyzer_type"],
                    "name": t["analyzer_type"],
                    "last_run": t["finished_at"],
                    "status": t["state"],
                })

        return {
            "summary": {
                "total_files": file_count,
                "total_commits": commit_count,
                "total_authors": author_count,
                "total_domains": domain_count,
                "overall_risk": overall_risk,
            },
            "analyzers": analyzers,
            "top_risks": [],
            "domain_overview": [],
        }
    except Exception as e:
        logger.warning(f"Intelligence dashboard failed: {e}")
        return {
            "summary": {"total_files": 0, "total_commits": 0, "total_authors": 0, "total_domains": 0, "overall_risk": 0},
            "analyzers": [],
            "top_risks": [],
            "domain_overview": [],
        }
    finally:
        storage.close()


@router.get("/architecture")
async def get_architecture_map(repo_id: str, data_dir: str = Query(default=None)):
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        domain_rows = storage.conn.execute(
            """
            SELECT e.entity_id AS domain_id, e.name, COUNT(r.src_entity_id) AS file_count
            FROM entities e
            LEFT JOIN relationships r ON r.dst_entity_id = e.entity_id
                AND r.source_type = 'semantic' AND r.rel_kind = 'BELONGS_TO_DOMAIN'
            WHERE e.kind = 'domain'
            GROUP BY e.entity_id
            """
        ).fetchall()

        domains = [
            {"domain_id": r["domain_id"], "name": r["name"], "file_count": r["file_count"], "dependencies": []}
            for r in domain_rows
        ]

        cross_rows = storage.conn.execute(
            """
            SELECT r1.dst_entity_id AS source_domain, r2.dst_entity_id AS target_domain,
                   COUNT(*) AS coupling_strength
            FROM relationships r1
            JOIN relationships r2 ON r1.src_entity_id = r2.src_entity_id
                AND r1.dst_entity_id < r2.dst_entity_id
            WHERE r1.source_type = 'semantic' AND r1.rel_kind = 'BELONGS_TO_DOMAIN'
              AND r2.source_type = 'semantic' AND r2.rel_kind = 'BELONGS_TO_DOMAIN'
            GROUP BY r1.dst_entity_id, r2.dst_entity_id
            ORDER BY coupling_strength DESC
            LIMIT 100
            """
        ).fetchall()

        cross_domain = [
            {
                "source_domain": r["source_domain"],
                "target_domain": r["target_domain"],
                "coupling_strength": r["coupling_strength"],
                "dependency_strength": 0,
                "combined_strength": r["coupling_strength"],
            }
            for r in cross_rows
        ]

        return {"domains": domains, "cross_domain_coupling": cross_domain}
    except Exception as e:
        logger.warning(f"Architecture map failed: {e}")
        return {"domains": [], "cross_domain_coupling": []}
    finally:
        storage.close()


@router.get("/correlations")
async def get_correlations(
    repo_id: str,
    min_git_coupling: float = 0.1,
    min_semantic_similarity: float = 0.3,
    data_dir: str = Query(default=None),
):
    if data_dir is None:
        data_dir = str(DEFAULT_DATA_DIR)
    storage = _storage(repo_id, data_dir)
    try:
        rows = storage.conn.execute(
            """
            SELECT e1.qualified_name AS file_a, e2.qualified_name AS file_b,
                   g.jaccard AS git_coupling
            FROM git_edges g
            JOIN entities e1 ON g.src_entity_id = e1.entity_id
            JOIN entities e2 ON g.dst_entity_id = e2.entity_id
            WHERE g.jaccard >= ?
            ORDER BY g.jaccard DESC
            LIMIT 200
            """,
            (min_git_coupling,),
        ).fetchall()

        file_pairs = []
        aligned = structural_only = logical_only = conflicted = 0
        for r in rows:
            status = "logical_only"
            aligned += 0
            logical_only += 1
            file_pairs.append({
                "file_a": r["file_a"],
                "file_b": r["file_b"],
                "git_coupling": r["git_coupling"],
                "dependency_coupling": False,
                "semantic_similarity": 0.0,
                "correlation_score": r["git_coupling"],
                "status": status,
            })

        return {
            "file_pairs": file_pairs,
            "summary": {
                "total_pairs": len(file_pairs),
                "aligned": aligned,
                "structural_only": structural_only,
                "logical_only": logical_only,
                "conflicted": conflicted,
            },
        }
    except Exception as e:
        logger.warning(f"Correlations failed: {e}")
        return {
            "file_pairs": [],
            "summary": {"total_pairs": 0, "aligned": 0, "structural_only": 0, "logical_only": 0, "conflicted": 0},
        }
    finally:
        storage.close()
