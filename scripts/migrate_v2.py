#!/usr/bin/env python3
"""Migrate from v1 to v2 storage format."""

import sqlite3
from pathlib import Path

import pyarrow.parquet as pq


def migrate_repo(repo_path: Path):
    """Migrate a single repository."""
    old_db = repo_path / "artifacts/v1/indexes/file_index.sqlite"
    new_db = repo_path / "lfca.sqlite"
    
    if not old_db.exists():
        print(f"No v1 data found in {repo_path}")
        return
    
    print(f"Migrating {repo_path}...")
    
    # Create new schema
    from lfca.schema import init_database
    new_conn = init_database(new_db)
    
    # Migrate files
    old_conn = sqlite3.connect(old_db)
    rows = old_conn.execute("""
        SELECT file_id, path_current, path_latest FROM file_index
    """).fetchall()
    
    for file_id, path_current, path_latest in rows:
        new_conn.execute("""
            INSERT INTO files (file_id, path_current, path_latest)
            VALUES (?, ?, ?)
        """, (file_id, path_current, path_latest or path_current))
    
    # Migrate edges from Parquet
    edges_parquet = repo_path / "artifacts/v1/edges/edges_file_topk.parquet"
    if edges_parquet.exists():
        table = pq.read_table(edges_parquet)
        for row in table.to_pylist():
            new_conn.execute("""
                INSERT OR IGNORE INTO edges (
                    src_file_id, dst_file_id, pair_count,
                    src_count, dst_count, src_weight, dst_weight,
                    jaccard, jaccard_weighted, p_dst_given_src, p_src_given_dst
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                row["src_file_id"], row["dst_file_id"], row["pair_count"],
                row["src_count"], row["dst_count"], 
                row.get("src_weight", row["src_count"]),
                row.get("dst_weight", row["dst_count"]),
                row["weight_jaccard"], row["weight_jaccard"],
                row["pair_count"] / row["src_count"] if row["src_count"] else 0,
                row["pair_count"] / row["dst_count"] if row["dst_count"] else 0,
            ))
    
    new_conn.commit()
    new_conn.close()
    old_conn.close()
    
    print(f"  Migrated {len(rows)} files")


if __name__ == "__main__":
    import sys
    data_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "data")
    
    repos_dir = data_dir / "repos"
    if repos_dir.exists():
        for repo_dir in repos_dir.iterdir():
            if repo_dir.is_dir():
                migrate_repo(repo_dir)
