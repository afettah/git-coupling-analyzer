"""Git Analyzer API - Production Implementation."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pyarrow.dataset as ds
from code_intel.logging_utils import get_logger
from code_intel.storage import Storage
from code_intel_interfaces.git_analyzer import GitAnalyzerAPI
from git_analyzer.file_metrics import (
    resolve_file_id,
    load_file_changes,
    load_commits_for_oids,
    load_all_commits,
    bucketize_ts,
    compute_bus_factor,
    compute_churn_trend,
    compute_risk_factors,
    detect_knowledge_silos,
    compute_coupling_timeline,
    compute_risk_timeline,
    compute_ownership_timeline,
    get_repo_averages,
)

logger = get_logger(__name__)

# Allowed metric columns for SQL queries (prevent SQL injection)
ALLOWED_METRICS = {"jaccard", "jaccard_weighted", "p_dst_given_src", "p_src_given_dst", "pair_count"}

# Allowed sort fields
ALLOWED_SORT_FIELDS = {"risk_score", "total_commits", "coupling", "authors", "lines_changed"}


class GitAPI(GitAnalyzerAPI):
    """Production implementation of GitAnalyzerAPI using git_edges table."""

    def _validate_metric(self, metric: str) -> None:
        """Validate metric parameter to prevent SQL injection."""
        if metric not in ALLOWED_METRICS:
            raise ValueError(
                f"Invalid metric: {metric}. Allowed: {', '.join(sorted(ALLOWED_METRICS))}"
            )

    def get_file_coupling(
        self,
        db_path: Path,
        file_path: str,
        *,
        metric: str = "jaccard",
        min_weight: float = 0.0,
        limit: int = 50,
    ) -> list[dict]:
        """Get coupling edges for a specific file."""
        self._validate_metric(metric)
        
        storage = Storage(db_path, db_path.parent / "parquet")
        try:
            # Find entity_id
            row = storage.conn.execute(
                "SELECT entity_id FROM entities WHERE qualified_name = ? AND kind = 'file'",
                (file_path,),
            ).fetchone()
            if not row:
                logger.warning(f"File not found: {file_path}")
                return []
            file_id = row[0]

            query = f"""
                SELECT * FROM (
                    SELECT 
                        e.qualified_name as path,
                        g.pair_count,
                        g.{metric} as weight,
                        g.jaccard,
                        g.jaccard_weighted,
                        g.p_dst_given_src,
                        g.p_src_given_dst
                    FROM git_edges g
                    JOIN entities e ON g.dst_entity_id = e.entity_id
                    WHERE g.src_entity_id = ? AND g.{metric} >= ?
                    UNION ALL
                    SELECT
                        e.qualified_name as path,
                        g.pair_count,
                        g.{metric} as weight,
                        g.jaccard,
                        g.jaccard_weighted,
                        g.p_src_given_dst as p_dst_given_src,
                        g.p_dst_given_src as p_src_given_dst
                    FROM git_edges g
                    JOIN entities e ON g.src_entity_id = e.entity_id
                    WHERE g.dst_entity_id = ? AND g.{metric} >= ?
                )
                ORDER BY weight DESC
                LIMIT ?
            """
            rows = storage.conn.execute(query, (file_id, min_weight, file_id, min_weight, limit)).fetchall()
            return [dict(row) for row in rows]
        finally:
            storage.close()

    def get_coupling_graph(
        self,
        db_path: Path,
        root_path: str,
        *,
        metric: str = "jaccard",
        min_weight: float = 0.1,
        limit: int = 200,
    ) -> dict:
        """Get coupling graph for files under root_path."""
        self._validate_metric(metric)
        
        storage = Storage(db_path, db_path.parent / "parquet")
        try:
            pattern = f"{root_path}%"
            query = f"""
                SELECT 
                    g.src_entity_id, g.dst_entity_id, g.{metric} as weight
                FROM git_edges g
                JOIN entities e1 ON g.src_entity_id = e1.entity_id
                JOIN entities e2 ON g.dst_entity_id = e2.entity_id
                WHERE e1.qualified_name LIKE ? AND e2.qualified_name LIKE ?
                  AND e1.kind = 'file' AND e2.kind = 'file'
                  AND g.{metric} >= ?
                ORDER BY g.{metric} DESC
                LIMIT ?
            """
            rows = storage.conn.execute(query, (pattern, pattern, min_weight, limit)).fetchall()

            edges = []
            node_ids = set()
            for row in rows:
                edges.append({"source": row[0], "target": row[1], "weight": row[2]})
                node_ids.add(row[0])
                node_ids.add(row[1])

            if not node_ids:
                return {"nodes": [], "edges": []}

            placeholders = ",".join("?" * len(node_ids))
            nodes_rows = storage.conn.execute(
                f"""
                SELECT entity_id as file_id, qualified_name as path, metadata_json
                FROM entities
                WHERE entity_id IN ({placeholders}) AND kind = 'file'
                """,
                list(node_ids),
            ).fetchall()

            nodes = []
            for row in nodes_rows:
                metadata = json.loads(row[2]) if row[2] else {}
                nodes.append({
                    "file_id": row[0],
                    "path": row[1],
                    "total_commits": metadata.get("total_commits", 0),
                })
            return {"nodes": nodes, "edges": edges}
        finally:
            storage.close()

    def get_file_history(
        self, db_path: Path, parquet_dir: Path, file_path: str
    ) -> dict:
        """Get file history including commits and renames."""
        storage = Storage(db_path, parquet_dir)
        try:
            row = storage.conn.execute(
                "SELECT entity_id FROM entities WHERE qualified_name = ? AND kind = 'file'",
                (file_path,),
            ).fetchone()
            if not row:
                return {"file_id": 0, "path": file_path, "commits": [], "renames": []}
            file_id = row[0]

            changes_path = parquet_dir / "changes.parquet"
            commits = []
            if changes_path.exists():
                dataset = ds.dataset(changes_path)
                table = dataset.to_table(filter=ds.field("file_id") == file_id)
                commits = table.to_pylist()

            renames = storage.conn.execute(
                """
                SELECT path, start_commit_oid, end_commit_oid
                FROM git_file_lineage
                WHERE entity_id = ?
                ORDER BY start_commit_oid
                """,
                (file_id,),
            ).fetchall()

            return {
                "file_id": file_id,
                "path": file_path,
                "commits": commits,
                "renames": [
                    {"path": r[0], "start": r[1], "end": r[2]} for r in renames
                ],
            }
        finally:
            storage.close()

    def get_file_details(
        self, db_path: Path, parquet_dir: Path, file_path: str
    ) -> dict:
        """Get comprehensive file details with pre-computed stats."""
        storage = Storage(db_path, parquet_dir)
        try:
            # Get basic file info with pre-computed stats
            row = storage.conn.execute(
                """
                SELECT entity_id, qualified_name, exists_at_head, metadata_json
                FROM entities 
                WHERE qualified_name = ? AND kind = 'file'
                """,
                (file_path,),
            ).fetchone()

            if not row:
                logger.warning(f"File not found: {file_path}")
                return {}

            file_id = row[0]
            metadata = json.loads(row[3]) if row[3] else {}
            
            # Extract pre-computed stats from metadata
            result = {
                "file_id": file_id,
                "path": row[1],
                "exists_at_head": row[2],
                "total_commits": metadata.get("total_commits", 0),
                "authors_count": metadata.get("authors_count", 0),
                "total_lines_added": metadata.get("total_lines_added", 0),
                "total_lines_deleted": metadata.get("total_lines_deleted", 0),
                "first_commit_oid": metadata.get("first_commit_oid"),
                "last_commit_oid": metadata.get("last_commit_oid"),
                "first_commit_ts": metadata.get("first_commit_ts"),
                "last_commit_ts": metadata.get("last_commit_ts"),
            }

            # Calculate churn rate
            commits = result["total_commits"]
            if commits > 0:
                total_changes = result["total_lines_added"] + result["total_lines_deleted"]
                result["churn_rate"] = round(total_changes / commits, 2)
            else:
                result["churn_rate"] = 0

            # Get coupling stats from git_edges
            coupling_row = storage.conn.execute(
                """
                SELECT 
                    COUNT(*) as coupled_count,
                    MAX(jaccard) as max_coupling,
                    AVG(jaccard) as avg_coupling
                FROM git_edges
                WHERE src_entity_id = ? OR dst_entity_id = ?
                """,
                (file_id, file_id),
            ).fetchone()

            if coupling_row:
                result["coupled_files_count"] = coupling_row[0] or 0
                result["max_coupling"] = round(coupling_row[1], 3) if coupling_row[1] else 0.0
                result["avg_coupling"] = round(coupling_row[2], 3) if coupling_row[2] else 0.0
            else:
                result["coupled_files_count"] = 0
                result["max_coupling"] = 0.0
                result["avg_coupling"] = 0.0

            # Calculate risk score
            coupling = result["max_coupling"]
            authors = result["authors_count"]
            churn = result["churn_rate"]

            risk_score = min(
                (commits / 10) * 30  # Commit frequency (0-30)
                + coupling * 30  # Coupling strength (0-30)
                + min(authors * 5, 20)  # Multiple authors (0-20)
                + min(churn / 50, 20),  # High churn (0-20)
                100,
            )
            result["risk_score"] = round(risk_score, 1)

            return result
        finally:
            storage.close()

    def get_hotspots(
        self,
        db_path: Path,
        parquet_dir: Path,
        *,
        limit: int = 50,
        sort_by: str = "risk_score",
    ) -> list[dict]:
        """Get code hotspots using pre-computed stats."""
        if sort_by not in ALLOWED_SORT_FIELDS:
            sort_by = "risk_score"
            
        storage = Storage(db_path, parquet_dir)
        try:
            # Query with pre-computed stats from metadata
            rows = storage.conn.execute(
                """
                SELECT 
                    e.entity_id,
                    e.qualified_name as path,
                    CAST(json_extract(e.metadata_json, '$.total_commits') AS INTEGER) as total_commits,
                    CAST(json_extract(e.metadata_json, '$.authors_count') AS INTEGER) as authors_count,
                    CAST(json_extract(e.metadata_json, '$.total_lines_added') AS INTEGER) as lines_added,
                    CAST(json_extract(e.metadata_json, '$.total_lines_deleted') AS INTEGER) as lines_deleted,
                    COALESCE(AVG(g.jaccard), 0) as avg_coupling,
                    COUNT(DISTINCT g.dst_entity_id) as coupled_files
                FROM entities e
                LEFT JOIN git_edges g ON (e.entity_id = g.src_entity_id OR e.entity_id = g.dst_entity_id)
                WHERE e.exists_at_head = 1 AND e.kind = 'file'
                GROUP BY e.entity_id, e.qualified_name
                """
            ).fetchall()

            # Calculate risk scores with the same formula used in get_file_details.
            results = []

            for row in rows:
                commits = row[2] or 0
                authors = row[3] or 0
                lines_added = row[4] or 0
                lines_deleted = row[5] or 0
                coupling = row[6] or 0
                coupled_count = row[7] or 0

                lines_changed = lines_added + lines_deleted

                churn_rate = (lines_changed / commits) if commits > 0 else 0.0
                risk_score = min(
                    (commits / 10) * 30
                    + coupling * 30
                    + min(authors * 5, 20)
                    + min(churn_rate / 50, 20),
                    100,
                )

                results.append({
                    "file_id": row[0],
                    "path": row[1],
                    "total_commits": commits,
                    "coupling": round(coupling, 3),
                    "riskScore": round(risk_score, 1),
                    "authors": authors,
                    "linesChanged": lines_changed,
                    "coupledFiles": coupled_count,
                })

            # Sort by requested metric
            if sort_by == "risk_score":
                results.sort(key=lambda x: x["riskScore"], reverse=True)
            elif sort_by == "total_commits":
                results.sort(key=lambda x: x["total_commits"], reverse=True)
            elif sort_by == "coupling":
                results.sort(key=lambda x: x["coupling"], reverse=True)
            elif sort_by == "authors":
                results.sort(key=lambda x: x["authors"], reverse=True)
            elif sort_by == "lines_changed":
                results.sort(key=lambda x: x["linesChanged"], reverse=True)

            return results[:limit]
        finally:
            storage.close()

    def get_dashboard_summary(self, db_path: Path, parquet_dir: Path) -> dict:
        """Get dashboard summary using pre-computed stats."""
        storage = Storage(db_path, parquet_dir)
        try:
            # Get repo-level summary from repo_meta (if available)
            summary_row = storage.conn.execute(
                "SELECT value FROM repo_meta WHERE key = 'summary_stats'"
            ).fetchone()
            
            if summary_row:
                # Use pre-computed summary
                summary = json.loads(summary_row[0])
                return summary

            # Fallback: compute from entities and parquet
            row = storage.conn.execute(
                "SELECT COUNT(*) FROM entities WHERE exists_at_head = 1 AND kind = 'file'"
            ).fetchone()
            file_count = row[0] if row else 0

            # Get commit count from parquet
            commit_count = 0
            commits_path = parquet_dir / "commits.parquet"
            if commits_path.exists():
                try:
                    dataset = ds.dataset(commits_path)
                    commit_count = dataset.count_rows()
                except Exception as e:
                    logger.warning(f"Failed to count commits: {e}")

            # Get total authors
            total_authors = 0
            if commits_path.exists():
                try:
                    table = ds.dataset(commits_path).to_table(columns=["author_email"])
                    total_authors = table.to_pandas()["author_email"].nunique()
                except Exception as e:
                    logger.warning(f"Failed to count authors: {e}")

            # Get average coupling from git_edges
            row = storage.conn.execute(
                "SELECT AVG(jaccard) FROM git_edges"
            ).fetchone()
            avg_coupling = round(row[0], 3) if row and row[0] else 0.0

            # Count hotspots (files with >50 commits)
            row = storage.conn.execute(
                """
                SELECT COUNT(*) FROM entities
                WHERE exists_at_head = 1 AND kind = 'file' 
                  AND CAST(json_extract(metadata_json, '$.total_commits') AS INTEGER) > 50
                """
            ).fetchone()
            hotspot_count = row[0] if row else 0

            # Calculate basic risk score
            row = storage.conn.execute(
                """
                SELECT 
                    AVG(CAST(json_extract(metadata_json, '$.total_commits') AS INTEGER)),
                    MAX(CAST(json_extract(metadata_json, '$.total_commits') AS INTEGER))
                FROM entities 
                WHERE exists_at_head = 1 AND kind = 'file'
                """
            ).fetchone()
            risk_score = 0.0
            if row and row[1]:
                avg_commits = row[0] or 0
                max_commits = row[1]
                risk_score = round(min(avg_commits / max(max_commits, 1) * 100, 100), 1)

            # Get lines from metadata aggregation
            row = storage.conn.execute(
                """
                SELECT 
                    SUM(CAST(json_extract(metadata_json, '$.total_lines_added') AS INTEGER)),
                    SUM(CAST(json_extract(metadata_json, '$.total_lines_deleted') AS INTEGER))
                FROM entities 
                WHERE exists_at_head = 1 AND kind = 'file'
                """
            ).fetchone()
            lines_added = row[0] or 0
            lines_deleted = row[1] or 0

            return {
                "file_count": file_count,
                "commit_count": commit_count,
                "author_count": total_authors,
                "avg_coupling": avg_coupling,
                "hotspot_count": hotspot_count,
                "risk_score": risk_score,
                "last_analyzed": None,
                "codebase_age": 0,
                "lines_added": lines_added,
                "lines_deleted": lines_deleted,
            }
        finally:
            storage.close()

    def get_component_coupling(
        self, db_path: Path, component: str, *, depth: int = 2
    ) -> list[dict]:
        """Get component-level coupling from git_component_edges."""
        storage = Storage(db_path, db_path.parent / "parquet")
        try:
            rows = storage.conn.execute(
                """
                SELECT src_component, dst_component, pair_count, jaccard, file_pair_count
                FROM git_component_edges
                WHERE (src_component = ? OR dst_component = ?) AND depth = ?
                ORDER BY jaccard DESC
                """,
                (component, component, depth),
            ).fetchall()

            return [dict(row) for row in rows]
        finally:
            storage.close()

    def run_clustering(
        self,
        db_path: Path,
        *,
        algorithm: str = "louvain",
        weight_column: str = "jaccard",
        min_weight: float = 0.1,
        folders: list[str] | None = None,
        params: dict | None = None,
    ) -> dict:
        """Run clustering algorithm and persist results."""
        self._validate_metric(weight_column)
        
        from git_analyzer.clustering.registry import get_algorithm
        import uuid

        storage = Storage(db_path, db_path.parent / "parquet")
        try:
            # Fetch graph from git_edges
            query = f"""
                SELECT src_entity_id, dst_entity_id, {weight_column}
                FROM git_edges
                WHERE {weight_column} >= ?
            """
            rows = storage.conn.execute(query, (min_weight,)).fetchall()

            # Fetch file paths for context
            files_rows = storage.conn.execute(
                "SELECT entity_id, qualified_name FROM entities WHERE exists_at_head = 1 AND kind = 'file'"
            ).fetchall()
            file_map = {r[0]: r[1] for r in files_rows}
            file_ids = set(file_map.keys())

            edges = []
            for row in rows:
                if row[0] in file_ids and row[1] in file_ids:
                    edges.append({
                        "src_file_id": row[0],
                        "dst_file_id": row[1],
                        weight_column: row[2],
                    })

            # Run algorithm
            algo = get_algorithm(algorithm)
            valid_params = params or {}
            result = algo.run(edges, file_ids, file_map, valid_params)

            # Persist results to database
            run_id = str(uuid.uuid4())
            
            with storage.transaction():
                # Save run metadata
                storage.conn.execute(
                    """
                    INSERT INTO git_cluster_runs (run_id, algorithm, params_json, cluster_count)
                    VALUES (?, ?, ?, ?)
                    """,
                    (run_id, algorithm, json.dumps(valid_params), result.cluster_count),
                )

                # Save clusters and members
                for cluster_id, members in enumerate(result.clusters, start=1):
                    storage.conn.execute(
                        """
                        INSERT INTO git_clusters (run_id, label, size)
                        VALUES (?, ?, ?)
                        """,
                        (run_id, f"Cluster {cluster_id}", len(members)),
                    )
                    db_cluster_id = storage.conn.lastrowid

                    for file_id in members:
                        storage.conn.execute(
                            """
                            INSERT INTO git_cluster_members (cluster_id, entity_id)
                            VALUES (?, ?)
                            """,
                            (db_cluster_id, file_id),
                        )

            result_dict = result.to_dict()
            result_dict["run_id"] = run_id
            return result_dict

        except Exception as e:
            logger.error(f"Clustering failed: {e}", exc_info=True)
            return {
                "error": "Clustering failed",
                "message": str(e),
                "success": False,
            }
        finally:
            storage.close()

    def get_file_tree(self, db_path: Path) -> dict:
        """Get file tree structure."""
        from git_analyzer.sync import build_file_tree

        parquet_dir = db_path.parent / "parquet"
        storage = Storage(db_path, parquet_dir)
        try:
            return build_file_tree(storage)
        finally:
            storage.close()

    def get_authors(
        self, db_path: Path, parquet_dir: Path, *, limit: int = 50
    ) -> list[dict]:
        """Get author statistics from parquet."""
        commits_path = parquet_dir / "commits.parquet"
        if not commits_path.exists():
            return []

        try:
            table = ds.dataset(commits_path).to_table(columns=["author_name"])
            df = table.to_pandas()
            stats = df["author_name"].value_counts().head(limit).reset_index()
            stats.columns = ["name", "commits"]
            return stats.to_dict(orient="records")
        except Exception as e:
            logger.error(f"Failed to get authors: {e}")
            return []

    def get_timeline(
        self,
        db_path: Path,
        parquet_dir: Path,
        *,
        points: int = 12,
        granularity: str = "monthly",
    ) -> list[dict]:
        """Get commit frequency timeline."""
        import pandas as pd

        commits_path = parquet_dir / "commits.parquet"
        if not commits_path.exists():
            return []

        try:
            table = ds.dataset(commits_path).to_table(columns=["committer_ts"])
            df = table.to_pandas()
            df["date"] = pd.to_datetime(df["committer_ts"], unit="s")

            freq = {"monthly": "ME", "weekly": "W", "daily": "D"}.get(
                granularity, "ME"
            )

            timeline = df.resample(freq, on="date").size().reset_index(name="count")
            timeline = timeline.tail(points)

            return timeline.apply(
                lambda x: {"date": x["date"].isoformat(), "count": int(x["count"])},
                axis=1,
            ).tolist()

        except Exception as e:
            logger.error(f"Failed to get timeline: {e}")
            return []

    def get_file_details_enhanced(
        self, db_path: Path, parquet_dir: Path, file_path: str
    ) -> dict:
        """Enhanced file details with risk factors, bus factor, knowledge silos."""
        storage = Storage(db_path, parquet_dir)
        try:
            file_id = resolve_file_id(storage, file_path)
            if file_id is None:
                return {}

            # Get base details from existing method
            base = self.get_file_details(db_path, parquet_dir, file_path)
            if not base:
                return {}

            # Load changes for this file
            changes_df = load_file_changes(parquet_dir, file_id)
            commit_oids = changes_df["commit_oid"].unique().tolist() if not changes_df.empty else []
            commits_df = load_commits_for_oids(parquet_dir, commit_oids)
            
            # Build author commit counts
            commit_author_map = {}
            if not commits_df.empty:
                commit_author_map = dict(zip(commits_df["commit_oid"], commits_df["author_name"]))
            
            author_commits: dict[str, int] = {}
            for oid in commit_oids:
                author = commit_author_map.get(oid, "Unknown")
                author_commits[author] = author_commits.get(author, 0) + 1

            # Bus factor
            bf_result = compute_bus_factor(author_commits)
            
            # Churn trend
            churn_trend = compute_churn_trend(changes_df)
            
            # Knowledge silos
            silos = detect_knowledge_silos(
                author_commits, bf_result["bus_factor"]
            )
            
            # Age in days
            first_ts = base.get("first_commit_ts")
            import time
            now = int(time.time())
            age_days = (now - first_ts) // 86400 if first_ts else 0
            
            # Top author share for risk computation
            top_author_share = bf_result["distribution"][0]["share"] if bf_result["distribution"] else 0
            
            # Repo averages for normalization
            repo_avgs = get_repo_averages(storage)
            
            # Risk factors
            risk = compute_risk_factors(
                total_commits=base.get("total_commits", 0),
                churn_rate=base.get("churn_rate", 0),
                churn_trend=churn_trend,
                max_coupling=base.get("max_coupling", 0),
                avg_coupling=base.get("avg_coupling", 0),
                coupled_files_count=base.get("coupled_files_count", 0),
                bus_factor=bf_result["bus_factor"],
                top_author_share=top_author_share,
                age_days=age_days,
                repo_avg_commits=repo_avgs["avg_commits"],
                repo_avg_churn=repo_avgs["avg_churn"],
            )
            
            # Build enhanced response
            base["age_days"] = age_days
            base["bus_factor"] = bf_result["bus_factor"]
            base["knowledge_silos"] = silos
            base["churn_trend"] = churn_trend["direction"]
            base["risk_score"] = risk["risk_score"]
            base["risk_trend"] = risk["risk_trend"]
            base["risk_factors"] = risk["risk_factors"]
            
            # Issue #2: Add missing fields expected by frontend
            from datetime import datetime, timezone
            
            # Convert timestamps to ISO date strings
            first_ts = base.get("first_commit_ts")
            last_ts = base.get("last_commit_ts")
            base["first_commit_date"] = datetime.fromtimestamp(first_ts, tz=timezone.utc).isoformat() if first_ts else None
            base["last_commit_date"] = datetime.fromtimestamp(last_ts, tz=timezone.utc).isoformat() if last_ts else None
            
            # Add top author from distribution
            base["top_author"] = bf_result["distribution"][0]["author"] if bf_result["distribution"] else None
            
            # Calculate commits_last_30_days from changes_df
            if not changes_df.empty and not commits_df.empty:
                commits_with_ts = commits_df.merge(
                    changes_df[["commit_oid"]].drop_duplicates(),
                    on="commit_oid"
                )
                thirty_days_ago = now - (30 * 86400)
                recent_commits = commits_with_ts[
                    commits_with_ts["authored_ts"] >= thirty_days_ago
                ] if "authored_ts" in commits_with_ts.columns else []
                base["commits_last_30_days"] = len(recent_commits)
            else:
                base["commits_last_30_days"] = 0
            
            # Calculate strong_coupling_count (coupling >= 0.5)
            strong_coupling_row = storage.conn.execute(
                """
                SELECT COUNT(*) 
                FROM git_edges
                WHERE (src_entity_id = ? OR dst_entity_id = ?)
                AND jaccard >= 0.5
                """,
                (file_id, file_id),
            ).fetchone()
            base["strong_coupling_count"] = strong_coupling_row[0] if strong_coupling_row else 0
            
            return base
        finally:
            storage.close()

    def get_file_activity_filtered(
        self,
        db_path: Path,
        parquet_dir: Path,
        file_path: str,
        *,
        from_ts: int | None = None,
        to_ts: int | None = None,
        granularity: str = "monthly",
    ) -> dict:
        """File activity with time-range filtering pushed to query level."""
        storage = Storage(db_path, parquet_dir)
        try:
            file_id = resolve_file_id(storage, file_path)
            if file_id is None:
                return {"commits_by_period": [], "lines_by_period": [], "authors_by_period": [], "heatmap_data": [], "day_hour_matrix": []}

            changes_df = load_file_changes(parquet_dir, file_id, from_ts=from_ts, to_ts=to_ts)
            if changes_df.empty:
                return {"commits_by_period": [], "lines_by_period": [], "authors_by_period": [], "heatmap_data": [], "day_hour_matrix": []}

            # Load commits for author info
            commit_oids = changes_df["commit_oid"].unique().tolist()
            commits_df = load_commits_for_oids(parquet_dir, commit_oids)
            commit_author_map = {}
            if not commits_df.empty:
                commit_author_map = dict(zip(commits_df["commit_oid"], commits_df["author_name"]))

            # Bucketize
            df = bucketize_ts(changes_df, "commit_ts", granularity)

            commits_by_period = []
            lines_by_period = []
            authors_by_period = []
            heatmap_data = []
            day_hour_matrix_data = []

            for bucket, group in sorted(df.groupby("bucket")):
                unique_oids = group["commit_oid"].unique()
                commits_by_period.append({"period": str(bucket), "count": len(unique_oids)})
                
                added = int(group["lines_added"].sum()) if "lines_added" in group.columns else 0
                deleted = int(group["lines_deleted"].sum()) if "lines_deleted" in group.columns else 0
                lines_by_period.append({"period": str(bucket), "added": added, "deleted": deleted})
                
                authors = set()
                for oid in unique_oids:
                    authors.add(commit_author_map.get(oid, "Unknown"))
                authors_by_period.append({"period": str(bucket), "count": len(authors)})

            # Heatmap data (daily counts for calendar view)
            import pandas as pd
            if "commit_ts" in changes_df.columns:
                ts_col = changes_df["commit_ts"]
                if pd.api.types.is_numeric_dtype(ts_col):
                    dates = pd.to_datetime(ts_col, unit="s", utc=True)
                else:
                    dates = pd.to_datetime(ts_col, utc=True)
                
                daily = dates.dt.strftime("%Y-%m-%d").value_counts().to_dict()
                heatmap_data = [{"date": d, "count": int(c)} for d, c in sorted(daily.items())]

                # Day-hour matrix
                day_hour_counts = dates.groupby([dates.dt.dayofweek, dates.dt.hour]).size()
                for (day, hour), count in day_hour_counts.items():
                    day_hour_matrix_data.append({"day": int(day), "hour": int(hour), "count": int(count)})

            return {
                "commits_by_period": commits_by_period,
                "lines_by_period": lines_by_period,
                "authors_by_period": authors_by_period,
                "heatmap_data": heatmap_data,
                "day_hour_matrix": day_hour_matrix_data,
            }
        finally:
            storage.close()

    def get_file_coupling_timeline(
        self,
        db_path: Path,
        parquet_dir: Path,
        file_path: str,
        *,
        from_ts: int | None = None,
        to_ts: int | None = None,
        granularity: str = "monthly",
    ) -> list[dict]:
        """Coupling evolution timeline for a file."""
        storage = Storage(db_path, parquet_dir)
        try:
            file_id = resolve_file_id(storage, file_path)
            if file_id is None:
                return []
            return compute_coupling_timeline(
                storage, parquet_dir, file_id,
                from_ts=from_ts, to_ts=to_ts, granularity=granularity,
            )
        finally:
            storage.close()

    def get_file_risk_timeline(
        self,
        db_path: Path,
        parquet_dir: Path,
        file_path: str,
        *,
        from_ts: int | None = None,
        to_ts: int | None = None,
        granularity: str = "monthly",
    ) -> list[dict]:
        """Risk score evolution timeline for a file."""
        storage = Storage(db_path, parquet_dir)
        try:
            file_id = resolve_file_id(storage, file_path)
            if file_id is None:
                return []
            return compute_risk_timeline(
                storage, parquet_dir, file_id,
                from_ts=from_ts, to_ts=to_ts, granularity=granularity,
            )
        finally:
            storage.close()

    def get_file_authors_enhanced(
        self,
        db_path: Path,
        parquet_dir: Path,
        file_path: str,
        *,
        from_ts: int | None = None,
        to_ts: int | None = None,
        granularity: str = "monthly",
    ) -> dict:
        """Enhanced file authors with bus factor and ownership timeline."""
        storage = Storage(db_path, parquet_dir)
        try:
            file_id = resolve_file_id(storage, file_path)
            if file_id is None:
                return {"authors": [], "bus_factor": 0, "ownership_timeline": []}

            changes_df = load_file_changes(parquet_dir, file_id, from_ts=from_ts, to_ts=to_ts)
            if changes_df.empty:
                return {"authors": [], "bus_factor": 0, "ownership_timeline": []}

            commit_oids = changes_df["commit_oid"].unique().tolist()
            commits_df = load_commits_for_oids(parquet_dir, commit_oids)
            commit_author_map = {}
            commit_ts_map = {}  # Track commit timestamps
            if not commits_df.empty:
                commit_author_map = dict(zip(commits_df["commit_oid"], commits_df["author_name"]))
                # Use authored_ts or committer_ts for timestamps
                commit_ts_map = dict(zip(
                    commits_df["commit_oid"],
                    commits_df.get("authored_ts", commits_df.get("committer_ts", [None] * len(commits_df)))
                ))

            # Build author stats (Issue #4: track first/last commit per author)
            author_commits: dict[str, dict] = {}
            total = len(commit_oids)
            for oid in commit_oids:
                author = commit_author_map.get(oid, "Unknown")
                ts = commit_ts_map.get(oid)
                if author not in author_commits:
                    author_commits[author] = {
                        "commits": 0, 
                        "lines_added": 0, 
                        "lines_deleted": 0,
                        "first_ts": ts,
                        "last_ts": ts,
                    }
                author_commits[author]["commits"] += 1
                # Update first/last timestamps
                if ts:
                    if author_commits[author]["first_ts"] is None or ts < author_commits[author]["first_ts"]:
                        author_commits[author]["first_ts"] = ts
                    if author_commits[author]["last_ts"] is None or ts > author_commits[author]["last_ts"]:
                        author_commits[author]["last_ts"] = ts

            # Add line stats per author from changes
            for _, row in changes_df.iterrows():
                author = commit_author_map.get(row.get("commit_oid", ""), "Unknown")
                if author in author_commits:
                    author_commits[author]["lines_added"] += int(row.get("lines_added", 0) or 0)
                    author_commits[author]["lines_deleted"] += int(row.get("lines_deleted", 0) or 0)

            # Bus factor
            author_commit_counts = {a: s["commits"] for a, s in author_commits.items()}
            bf_result = compute_bus_factor(author_commit_counts)

            # Format authors list (Issue #4: include first/last commit dates)
            from datetime import datetime, timezone
            sorted_authors = sorted(author_commits.items(), key=lambda x: -x[1]["commits"])
            authors_list = [
                {
                    "name": name,
                    "commits": stats["commits"],
                    "percentage": round(stats["commits"] / total * 100, 1) if total else 0,
                    "lines_added": stats["lines_added"],
                    "lines_deleted": stats["lines_deleted"],
                    "first_commit": datetime.fromtimestamp(stats["first_ts"], tz=timezone.utc).isoformat() if stats["first_ts"] else None,
                    "last_commit": datetime.fromtimestamp(stats["last_ts"], tz=timezone.utc).isoformat() if stats["last_ts"] else None,
                }
                for name, stats in sorted_authors
            ]

            # Ownership timeline
            timeline = compute_ownership_timeline(changes_df, commit_author_map, granularity)

            return {
                "authors": authors_list,
                "bus_factor": bf_result["bus_factor"],
                "ownership_timeline": timeline,
            }
        finally:
            storage.close()
