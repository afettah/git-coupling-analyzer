import json
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

from code_intel.storage import Storage
from git_analyzer.file_metrics import materialize_hot_stable_metrics
from git_analyzer.sync import build_file_tree


def _write_changes_parquet(parquet_dir: Path, rows: list[dict]) -> None:
    table = pa.Table.from_pylist(rows)
    pq.write_table(table, parquet_dir / "changes.parquet")


def test_materialize_hot_stable_metrics_and_thresholds(tmp_path: Path) -> None:
    db_path = tmp_path / "code-intel.sqlite"
    parquet_dir = tmp_path / "parquet"
    storage = Storage(db_path, parquet_dir)
    now_ts = 1_750_000_000

    try:
        hot_id = storage.get_or_create_entity(
            kind="file",
            name="hot.py",
            qualified_name="src/hot.py",
            metadata_json={
                "total_commits": 120,
                "first_commit_ts": now_ts - (400 * 86400),
                "last_commit_ts": now_ts - (2 * 86400),
            },
        )
        stable_id = storage.get_or_create_entity(
            kind="file",
            name="stable.py",
            qualified_name="src/stable.py",
            metadata_json={
                "total_commits": 10,
                "first_commit_ts": now_ts - (800 * 86400),
                "last_commit_ts": now_ts - (365 * 86400),
            },
        )
        unknown_id = storage.get_or_create_entity(
            kind="file",
            name="unknown.py",
            qualified_name="src/unknown.py",
            metadata_json={"total_commits": 0},
        )
        storage.conn.commit()

        rows: list[dict] = []
        for idx in range(12):
            rows.append({
                "commit_oid": f"hot-30-{idx}",
                "file_id": hot_id,
                "path": "src/hot.py",
                "status": "M",
                "old_path": "",
                "commit_ts": now_ts - (idx * 86400),
            })
        for idx in range(13):
            rows.append({
                "commit_oid": f"hot-90-{idx}",
                "file_id": hot_id,
                "path": "src/hot.py",
                "status": "M",
                "old_path": "",
                "commit_ts": now_ts - ((31 + idx) * 86400),
            })
        rows.append({
            "commit_oid": "stable-old-0",
            "file_id": stable_id,
            "path": "src/stable.py",
            "status": "M",
            "old_path": "",
            "commit_ts": now_ts - (300 * 86400),
        })
        _write_changes_parquet(parquet_dir, rows)

        thresholds = materialize_hot_stable_metrics(storage, parquet_dir, now_ts=now_ts)

        assert thresholds["T_hot30"] >= 3
        assert thresholds["T_hot90"] >= 6
        assert thresholds["T_stableDays"] >= 180

        rows = storage.conn.execute(
            "SELECT entity_id, metadata_json FROM entities WHERE kind = 'file' ORDER BY entity_id"
        ).fetchall()
        metadata_by_id = {row[0]: json.loads(row[1]) for row in rows}

        hot_meta = metadata_by_id[hot_id]
        assert hot_meta["commits_30d"] == 12
        assert hot_meta["commits_90d"] == 25
        assert hot_meta["is_hot"] is True
        assert hot_meta["is_stable"] is False
        assert hot_meta["is_unknown"] is False

        stable_meta = metadata_by_id[stable_id]
        assert stable_meta["is_hot"] is False
        assert stable_meta["is_stable"] is True
        assert stable_meta["is_unknown"] is False
        assert stable_meta["commits_90d"] == 0

        unknown_meta = metadata_by_id[unknown_id]
        assert unknown_meta["is_unknown"] is True
        assert unknown_meta["is_hot"] is False
        assert unknown_meta["is_stable"] is False

        threshold_row = storage.conn.execute(
            "SELECT value FROM repo_meta WHERE key = 'hot_stable_thresholds'"
        ).fetchone()
        assert threshold_row is not None
        stored = json.loads(threshold_row[0])
        assert stored["files_total"] == 3
    finally:
        storage.close()


def test_build_file_tree_contains_hot_stable_fields(tmp_path: Path) -> None:
    db_path = tmp_path / "code-intel.sqlite"
    parquet_dir = tmp_path / "parquet"
    storage = Storage(db_path, parquet_dir)
    now_ts = 1_750_000_000

    try:
        file_id = storage.get_or_create_entity(
            kind="file",
            name="hot.py",
            qualified_name="src/hot.py",
            metadata_json={
                "total_commits": 14,
                "first_commit_ts": now_ts - (100 * 86400),
                "last_commit_ts": now_ts - (2 * 86400),
                "commits_30d": 8,
                "commits_90d": 11,
                "lifetime_commits_per_month": 4.2,
                "days_since_last_change": 2,
                "is_hot": True,
                "is_stable": False,
                "is_unknown": False,
            },
        )
        storage.conn.commit()

        tree = build_file_tree(storage)
        node = tree["src"]["__children"]["hot.py"]

        assert node["file_id"] == file_id
        assert node["entity_id"] == file_id
        assert node["total_commits"] == 14
        assert node["commits_30d"] == 8
        assert node["commits_90d"] == 11
        assert node["lifetime_commits_per_month"] == 4.2
        assert node["days_since_last_change"] == 2
        assert node["is_hot"] is True
        assert node["is_stable"] is False
        assert node["is_unknown"] is False
        assert isinstance(node["last_modified"], str)
        assert node["last_modified"].endswith("+00:00")
    finally:
        storage.close()
