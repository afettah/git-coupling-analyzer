from __future__ import annotations

import datetime
from pathlib import Path
from typing import Any, List

import pyarrow.dataset as ds
from code_intel_interfaces.git_analyzer import GitAnalyzerAPI
from git_analyzer.clustering.insights import calculate_cluster_insights, compare_clusters
from git_analyzer.sync import build_file_tree, get_folder_list
# We'll need a way to get a connection from db_path. 
# Since we are in the git-analyzer package, we can use a simple sqlite3 connection or reuse platform's Storage if we want.
# The design says analyzers can depend on platform interfaces.
import sqlite3

class GitAPI(GitAnalyzerAPI):
    """Implementation of GitAnalyzerAPI."""

    def _get_conn(self, db_path: Path):
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def get_file_coupling(self, db_path: Path, file_path: str, *,
                          metric: str = "jaccard", min_weight: float = 0.0,
                          limit: int = 50) -> list[dict]:
        conn = self._get_conn(db_path)
        try:
            # Find entity_id
            row = conn.execute("SELECT entity_id FROM entities WHERE qualified_name = ?", (file_path,)).fetchone()
            if not row:
                return []
            entity_id = row[0]

            query = f"""
                SELECT path, weight, properties_json FROM (
                    SELECT 
                        e2.qualified_name as path,
                        r.weight,
                        r.properties_json
                    FROM relationships r
                    JOIN entities e2 ON r.dst_entity_id = e2.entity_id
                    WHERE r.src_entity_id = ? AND r.weight >= ? AND r.source_type = 'git'
                    
                    UNION ALL
                    
                    SELECT 
                        e1.qualified_name as path,
                        r.weight,
                        r.properties_json
                    FROM relationships r
                    JOIN entities e1 ON r.src_entity_id = e1.entity_id
                    WHERE r.dst_entity_id = ? AND r.weight >= ? AND r.source_type = 'git'
                )
                ORDER BY weight DESC
                LIMIT ?
            """
            rows = conn.execute(query, (entity_id, min_weight, entity_id, min_weight, limit)).fetchall()
            
            results = []
            for r in rows:
                props = json.loads(r[2]) if r[2] else {}
                item = {
                    "path": r[0],
                    "weight": r[1],
                    "pair_count": props.get("pair_count", 0),
                    "jaccard": r[1],
                    "jaccard_weighted": props.get("jaccard_weighted", 0),
                    "p_dst_given_src": props.get("p_dst_given_src", 0),
                    "p_src_given_dst": props.get("p_src_given_dst", 0)
                }
                results.append(item)
            return results
        finally:
            conn.close()

    def get_coupling_graph(self, db_path: Path, root_path: str, *,
                           metric: str = "jaccard", min_weight: float = 0.1,
                           limit: int = 200) -> dict:
        conn = self._get_conn(db_path)
        try:
            query = """
                SELECT 
                    r.src_entity_id, r.dst_entity_id, r.weight
                FROM relationships r
                JOIN entities e1 ON r.src_entity_id = e1.entity_id
                JOIN entities e2 ON r.dst_entity_id = e2.entity_id
                WHERE e1.qualified_name LIKE ? AND e2.qualified_name LIKE ?
                AND r.weight >= ? AND r.source_type = 'git'
                ORDER BY r.weight DESC
                LIMIT ?
            """
            pattern = f"{root_path}%"
            rows = conn.execute(query, (pattern, pattern, min_weight, limit)).fetchall()
            
            edges = []
            node_ids = set()
            for r in rows:
                edges.append({"source": r[0], "target": r[1], "weight": r[2]})
                node_ids.add(r[0])
                node_ids.add(r[1])
            
            if not node_ids:
                return {"nodes": [], "edges": []}
            
            placeholders = ",".join("?" * len(node_ids))
            nodes_rows = conn.execute(f"""
                SELECT entity_id, qualified_name as path, metadata_json
                FROM entities
                WHERE entity_id IN ({placeholders})
            """, list(node_ids)).fetchall()
            
            nodes = []
            for r in nodes_rows:
                meta = json.loads(r[2]) if r[2] else {}
                nodes.append({
                    "entity_id": r[0],
                    "path": r[1],
                    "total_commits": meta.get("total_commits", 0)
                })
            return {"nodes": nodes, "edges": edges}
        finally:
            conn.close()

    def get_file_history(self, db_path: Path, parquet_dir: Path,
                         file_path: str) -> dict:
        conn = self._get_conn(db_path)
        try:
            row = conn.execute("SELECT entity_id FROM entities WHERE qualified_name = ?", (file_path,)).fetchone()
            if not row:
                return {"file_id": 0, "path": file_path, "commits": [], "renames": []}
            file_id = row[0]
            
            changes_path = parquet_dir / "changes.parquet"
            if changes_path.exists():
                dataset = ds.dataset(changes_path)
                table = dataset.to_table(filter=ds.field("file_id") == file_id)
                commits = table.to_pylist()
            else:
                commits = []
            
            renames = conn.execute("""
                SELECT path, start_commit_oid, end_commit_oid
                FROM file_lineage
                WHERE file_id = ?
                ORDER BY start_commit_oid
            """, (file_id,)).fetchall()
            
            return {
                "file_id": file_id,
                "path": file_path,
                "commits": commits,
                "renames": [{"path": r[0], "start": r[1], "end": r[2]} for r in renames]
            }
        finally:
            conn.close()

    def get_file_details(self, db_path: Path, parquet_dir: Path,
                         file_path: str) -> dict:
        conn = self._get_conn(db_path)
        try:
            row = conn.execute("""
                SELECT entity_id, qualified_name, exists_at_head, metadata_json
                FROM entities WHERE qualified_name = ?
            """, (file_path,)).fetchone()
            if not row:
                return {}
            
            meta = json.loads(row[3]) if row[3] else {}
            res = {
                "file_id": row[0],
                "path": row[1],
                "exists_at_head": bool(row[2]),
                "total_commits": meta.get("total_commits", 0),
                "total_lines_added": meta.get("total_lines_added", 0),
                "total_lines_deleted": meta.get("total_lines_deleted", 0),
            }
            return res
        finally:
            conn.close()

    def get_hotspots(self, db_path: Path, parquet_dir: Path, *,
                     limit: int = 50, sort_by: str = "risk_score") -> list[dict]:
        conn = self._get_conn(db_path)
        try:
            # Hotspots logic - ordering by commits as proxy for now
            rows = conn.execute("""
                SELECT entity_id, qualified_name as path, metadata_json
                FROM entities
                WHERE exists_at_head = 1 AND kind = 'file'
            """).fetchall()
            
            results = []
            for r in rows:
                meta = json.loads(r[2]) if r[2] else {}
                results.append({
                    "file_id": r[0],
                    "path": r[1],
                    "total_commits": meta.get("total_commits", 0),
                    "total_lines_added": meta.get("total_lines_added", 0),
                    "total_lines_deleted": meta.get("total_lines_deleted", 0)
                })
            
            # Sort behavior
            srk = sort_by if sort_by in ["total_commits", "total_lines_added"] else "total_commits"
            results.sort(key=lambda x: x.get(srk, 0), reverse=True)
            return results[:limit]
        finally:
            conn.close()

    def get_dashboard_summary(self, db_path: Path, parquet_dir: Path) -> dict:
        conn = self._get_conn(db_path)
        try:
            row = conn.execute("SELECT COUNT(*) FROM entities WHERE exists_at_head = 1 AND kind = 'file'").fetchone()
            file_count = row[0] if row else 0
            
            row = conn.execute("SELECT SUM(entity_count) FROM analysis_tasks WHERE analyzer_type = 'git'").fetchone()
            commit_count = row[0] if row else 0
            
            return {
                "file_count": file_count,
                "commit_count": commit_count
            }
        finally:
            conn.close()

    def get_component_coupling(self, db_path: Path, component: str, *,
                                depth: int = 2) -> list[dict]:
        # Implementation from api.py
        return []

    def run_clustering(self, db_path: Path, *,
                       algorithm: str = "louvain", weight_column: str = "jaccard",
                       min_weight: float = 0.1, folders: list[str] | None = None,
                       params: dict | None = None) -> dict:
        """Run clustering algorithm."""
        from git_analyzer.clustering.registry import get_algorithm
        from git_analyzer.clustering.base import ClusterResult
        import networkx as nx
        
        conn = self._get_conn(db_path)
        try:
            # Fetch graph
            query = f"""
                SELECT src_entity_id, dst_entity_id, weight
                FROM relationships
                WHERE weight >= ? AND source_type = 'git'
            """
            rows = conn.execute(query, (min_weight,)).fetchall()
            
            # Fetch file paths for context
            files_rows = conn.execute("SELECT entity_id, qualified_name FROM entities WHERE exists_at_head = 1").fetchall()
            file_map = {r[0]: r[1] for r in files_rows}
            file_ids = set(file_map.keys())
            
            edges = []
            for r in rows:
                if r[0] in file_ids and r[1] in file_ids:
                    edges.append({"source": r[0], "target": r[1], "weight": r[2]})
            
            # 2. Run algorithm
            algo = get_algorithm(algorithm)
            # Filter valid params
            valid_params = {}
            if params:
                valid_params = params # specific validation could happen here
                
            result: ClusterResult = algo.run(edges, file_ids, file_map, valid_params)
            
            # 3. Save result (Optional: save to DB 'clusters' table)
            # For now, we return the result directly. 
            # Ideally we should persist it.
            
            return result.to_dict()
            
        except Exception as e:
            import traceback
            return {"error": str(e), "traceback": traceback.format_exc()}
        finally:
            conn.close()

    def get_file_tree(self, db_path: Path) -> dict:
        """Get file tree structure using Storage."""
        from code_intel.storage import Storage
        from git_analyzer.sync import build_file_tree
        
        # We need a minimal storage instance. 
        # Since we don't have parquet_dir here, we'll pass a dummy or None if Storage allows.
        # Storage(db_path, parquet_dir)
        # If parquet_dir is required by Storage __init__, we need to fake it or derive it.
        # RepoPaths derives parquet_dir as siblings.
        repo_root = db_path.parent
        parquet_dir = repo_root / "parquet"
        
        storage = Storage(db_path, parquet_dir)
        try:
            return build_file_tree(storage)
        finally:
            storage.close()

    def get_authors(self, db_path: Path, parquet_dir: Path, *,
                    limit: int = 50) -> list[dict]:
        """Get author statistics from parquet."""
        import pyarrow.dataset as ds
        import pandas as pd
        
        commits_path = parquet_dir / "commits.parquet"
        if not commits_path.exists():
            return []
            
        try:
            dataset = ds.dataset(commits_path, format="parquet")
            # We need author_name.
            # Assuming schema has author_name
            table = dataset.to_table(columns=["author_name"])
            df = table.to_pandas()
            
            stats = df['author_name'].value_counts().head(limit).reset_index()
            stats.columns = ['name', 'commits']
            return stats.to_dict(orient="records")
        except Exception as e:
            # Fallback or error
            return [{"error": str(e)}]

    def get_timeline(self, db_path: Path, parquet_dir: Path, *,
                     points: int = 12, granularity: str = "monthly") -> list[dict]:
        """Get commit frequency timeline."""
        import pyarrow.dataset as ds
        import pandas as pd
        
        commits_path = parquet_dir / "commits.parquet"
        if not commits_path.exists():
            return []
            
        try:
            dataset = ds.dataset(commits_path, format="parquet")
            table = dataset.to_table(columns=["committer_ts"])
            df = table.to_pandas()
            
            # Convert to datetime
            df['date'] = pd.to_datetime(df['committer_ts'], unit='s')
            
            if granularity == "monthly":
                freq = "M"
            elif granularity == "weekly":
                freq = "W"
            else:
                freq = "D"
                
            timeline = df.resample(freq, on='date').size().reset_index(name='count')
            # Take last N points
            timeline = timeline.tail(points)
            
            return timeline.apply(lambda x: {
                "date": x['date'].isoformat(),
                "count": int(x['count'])
            }, axis=1).tolist()
            
        except Exception as e:
            return []
