"""Cluster insights generation."""

from __future__ import annotations
import json
import pyarrow as pa
import pyarrow.compute as pc
import pandas as pd
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from code_intel.storage import Storage
    from git_analyzer.clustering.base import ClusterResult

def calculate_cluster_insights(storage: Storage, result: ClusterResult, edges: list[dict] | None = None):
    """Enhance cluster result with insights.
    
    Args:
        storage: Storage backend
        result: Clustering result to enhance
        edges: Optional list of edge dicts (src_file_id, dst_file_id, jaccard) involved in these clusters.
               If provided, avoids re-querying the database for coupling stats.
    """
    if not result.clusters:
        return result

    # Load changes and commits
    try:
        changes_table = storage.read_parquet("changes")
        commits_table = storage.read_parquet("commits")
    except FileNotFoundError:
        # If no parquet files (e.g. analysis not run), return as is
        return result

    # Convert to pandas for easier aggregation if it's not too large
    # For very large repos, we might want to stay in Arrow
    changes_df = changes_table.to_pandas()
    commits_df = commits_table.to_pandas()
    
    # Merge to get author info in changes
    changes_with_authors = changes_df.merge(
        commits_df[['commit_oid', 'author_name', 'author_email', 'message_subject']], 
        on='commit_oid'
    )

    # Get file stats from DB for churn and paths
    file_ids = []
    for c in result.clusters:
        file_ids.extend(c['file_ids'])
    
    file_ids = list(set(file_ids))
    placeholders = ",".join("?" * len(file_ids))
    rows = storage.conn.execute(f"""
        SELECT entity_id, qualified_name, metadata_json FROM entities WHERE entity_id IN ({placeholders})
    """, file_ids).fetchall()
    
    file_info = {}
    for r in rows:
        meta = json.loads(r[2]) if r[2] else {}
        file_info[r[0]] = {"path": r[1], "churn": meta.get("total_commits", 0)}

    # Internal edges for coupling calculation
    # We might want to pass all edges to this function to avoid re-querying
    # For now, let's assume we can get them if needed or they were passed
    
    for cluster in result.clusters:
        c_fids = set(cluster['file_ids'])
        
        # Filter changes for this cluster
        cluster_changes = changes_with_authors[changes_with_authors['file_id'].isin(c_fids)]
        
        # 1. Churn
        cluster['total_churn'] = sum(file_info.get(fid, {}).get('churn', 0) for fid in c_fids)
        
        # 1.5 Average Coupling
        if len(c_fids) > 1:
            if edges:
                # Use provided edges (in-memory)
                # Filter edges where both src and dst are in c_fids
                cluster_edges_weights = [
                    e['jaccard'] for e in edges 
                    if e['src_file_id'] in c_fids and e['dst_file_id'] in c_fids
                ]
                count = len(cluster_edges_weights)
                cluster['avg_coupling'] = sum(cluster_edges_weights) / count if count > 0 else 0.0
            else:
                # Fallback to DB query
                placeholders = ",".join("?" * len(c_fids))
                internal_edges = storage.conn.execute(f"""
                    SELECT weight FROM relationships 
                    WHERE src_entity_id IN ({placeholders}) AND dst_entity_id IN ({placeholders})
                      AND source_type = 'git'
                """, list(c_fids) + list(c_fids)).fetchall()
                
                if internal_edges:
                    cluster['avg_coupling'] = sum(e[0] for e in internal_edges) / len(internal_edges)
                else:
                    cluster['avg_coupling'] = 0.0
        else:
            cluster['avg_coupling'] = 0.0
        
        # 2. Hot Files (Top 5 by churn)
        hot_files = []
        c_files_info = [(fid, file_info.get(fid, {})) for fid in c_fids]
        c_files_info.sort(key=lambda x: x[1].get('churn', 0), reverse=True)
        for fid, info in c_files_info[:5]:
            hot_files.append({
                "path": info.get('path', f"file:{fid}"),
                "churn": info.get('churn', 0)
            })
        cluster['hot_files'] = hot_files
        
        # 3. Top Commits (commmits touching most files in cluster)
        top_commits = cluster_changes.groupby('commit_oid').agg({
            'file_id': 'count',
            'message_subject': 'first',
            'author_name': 'first'
        }).rename(columns={'file_id': 'file_count'}).sort_values('file_count', ascending=False).head(5)
        
        cluster['top_commits'] = [
            {
                "oid": index,
                "message": row['message_subject'],
                "author": row['author_name'],
                "file_count": int(row['file_count'])
            }
            for index, row in top_commits.iterrows()
        ]
        
        # 4. Common Authors
        common_authors = cluster_changes.groupby(['author_name', 'author_email']).agg({
            'commit_oid': 'nunique'
        }).rename(columns={'commit_oid': 'commit_count'}).sort_values('commit_count', ascending=False).head(5)
        
        cluster['common_authors'] = [
            {
                "name": index[0],
                "email": index[1],
                "commit_count": int(row['commit_count'])
            }
            for index, row in common_authors.iterrows()
        ]

    return result

def compare_clusters(old_result: dict, new_result: dict) -> dict:
    """Compare two clustering results and identify drift and flows."""
    old_clusters = old_result.get('clusters', [])
    new_clusters = new_result.get('clusters', [])
    
    flows = []
    comparisons = []
    
    # 1. Calculate all flows (intersections)
    # We want to know where the files from old_cluster X went in new_result
    
    for oc in old_clusters:
        oc_fids = set(oc['file_ids'])
        oc_size = len(oc_fids)
        
        best_match = None
        max_overlap = 0
        
        # Track where this cluster's files went
        for nc in new_clusters:
            nc_fids = set(nc['file_ids'])
            overlap = len(oc_fids.intersection(nc_fids))
            
            if overlap > 0:
                flows.append({
                    "source": oc['id'],
                    "target": nc['id'],
                    "value": overlap
                })
                
            if overlap > max_overlap:
                max_overlap = overlap
                best_match = nc
        
        # Determine status based on best match
        if best_match:
            overlap_ratio = max_overlap / max(oc_size, len(set(best_match['file_ids'])))
            comparisons.append({
                "old_id": oc['id'],
                "new_id": best_match['id'],
                "overlap_count": max_overlap,
                "overlap_ratio": overlap_ratio,
                "status": "stable" if overlap_ratio > 0.8 else "drifted",
                "size_diff": len(best_match['file_ids']) - oc_size
            })
        else:
            comparisons.append({
                "old_id": oc['id'],
                "new_id": None,
                "status": "dissolved"
            })

    # Find new clusters (those that weren't the best match for any old cluster)
    matched_new_ids = {c['new_id'] for c in comparisons if c['new_id'] is not None}
    for nc in new_clusters:
        if nc['id'] not in matched_new_ids:
            comparisons.append({
                "old_id": None,
                "new_id": nc['id'],
                "status": "new"
            })

    return {
        "comparisons": comparisons,
        "flows": flows,
        "nodes": {
            "old": [{"id": c['id'], "size": c['size']} for c in old_clusters],
            "new": [{"id": c['id'], "size": c['size']} for c in new_clusters]
        },
        "summary": {
            "stable": len([c for c in comparisons if c.get('status') == 'stable']),
            "drifted": len([c for c in comparisons if c.get('status') == 'drifted']),
            "dissolved": len([c for c in comparisons if c.get('status') == 'dissolved']),
            "new": len([c for c in comparisons if c.get('status') == 'new']),
        }
    }
