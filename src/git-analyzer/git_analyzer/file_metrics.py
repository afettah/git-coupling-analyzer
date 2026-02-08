"""Shared metrics helpers for file-details API endpoints."""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import pyarrow.dataset as ds
from code_intel.storage import Storage


def resolve_file_id(storage: Storage, path: str) -> int | None:
    """Resolve a file path to its entity_id, or None if not found."""
    row = storage.conn.execute(
        "SELECT entity_id FROM entities WHERE qualified_name = ? AND kind = 'file'",
        (path,),
    ).fetchone()
    return row[0] if row else None


def load_file_changes(
    parquet_dir: Path,
    file_id: int,
    *,
    from_ts: int | None = None,
    to_ts: int | None = None,
) -> pd.DataFrame:
    """Load changes for a file from parquet, optionally filtered by time range.

    Returns DataFrame with columns: commit_oid, file_id, path, status, old_path, commit_ts
    """
    changes_path = parquet_dir / "changes.parquet"
    if not changes_path.exists():
        return pd.DataFrame()

    filter_expr = ds.field("file_id") == file_id
    if from_ts is not None:
        filter_expr = filter_expr & (ds.field("commit_ts") >= from_ts)
    if to_ts is not None:
        filter_expr = filter_expr & (ds.field("commit_ts") <= to_ts)

    table = ds.dataset(changes_path).to_table(filter=filter_expr)
    return table.to_pandas()


def load_commits_for_oids(
    parquet_dir: Path,
    commit_oids: list[str],
) -> pd.DataFrame:
    """Load commit metadata for specific OIDs from parquet.

    Returns DataFrame with: commit_oid, author_name, author_email, authored_ts,
    committer_ts, is_merge, parent_count, message_subject
    """
    commits_path = parquet_dir / "commits.parquet"
    if not commits_path.exists():
        return pd.DataFrame()

    table = ds.dataset(commits_path).to_table()
    df = table.to_pandas()
    if commit_oids:
        df = df[df["commit_oid"].isin(set(commit_oids))]
    return df


def load_all_commits(parquet_dir: Path) -> pd.DataFrame:
    """Load all commits from parquet."""
    commits_path = parquet_dir / "commits.parquet"
    if not commits_path.exists():
        return pd.DataFrame()
    return ds.dataset(commits_path).to_table().to_pandas()


def bucketize_ts(
    df: pd.DataFrame,
    ts_col: str,
    granularity: str = "monthly",
) -> pd.DataFrame:
    """Add a 'bucket' column based on timestamp column and granularity.

    ts_col should be an integer (epoch seconds) or datetime column.
    granularity: "daily", "weekly", "monthly"
    Returns df with an added 'bucket' column (period start as ISO date string).
    """
    if df.empty:
        return df.assign(bucket=pd.Series(dtype=str))

    col = df[ts_col]
    if pd.api.types.is_numeric_dtype(col):
        dt = pd.to_datetime(col, unit="s", utc=True)
    else:
        dt = pd.to_datetime(col, utc=True)

    # pandas>=2.2 disallows "MS" for Period conversion (requires "M").
    freq_map = {
        "daily": "D",
        "weekly": "W-MON",
        "monthly": "M",
        "quarterly": "Q",
    }
    freq = freq_map.get(granularity, "M")

    df = df.copy()
    # Convert tz-aware datetimes to naive UTC before Period conversion.
    dt_naive = dt.dt.tz_localize(None)
    df["bucket"] = dt_naive.dt.to_period(freq).dt.start_time.dt.strftime("%Y-%m-%d")
    return df


def compute_bus_factor(
    author_commits: dict[str, int],
    threshold: float = 0.5,
) -> dict[str, Any]:
    """Compute bus factor from author -> commit_count mapping.

    Bus factor = minimum number of authors whose cumulative share >= threshold.

    Returns:
        {
            "bus_factor": int,
            "distribution": [
                {"author": str, "commits": int, "share": float, "cumulative_share": float},
                ...
            ]
        }
    """
    if not author_commits:
        return {"bus_factor": 0, "distribution": []}

    total = sum(author_commits.values())
    if total == 0:
        return {"bus_factor": 0, "distribution": []}

    sorted_authors = sorted(author_commits.items(), key=lambda x: -x[1])
    distribution = []
    cumulative = 0.0
    bus_factor = len(sorted_authors)

    for i, (author, commits) in enumerate(sorted_authors):
        share = commits / total
        cumulative += share
        distribution.append({
            "author": author,
            "commits": commits,
            "share": round(share, 3),
            "cumulative_share": round(cumulative, 3),
        })
        if cumulative >= threshold and bus_factor == len(sorted_authors):
            bus_factor = i + 1

    return {"bus_factor": bus_factor, "distribution": distribution}


def compute_churn_trend(
    changes_df: pd.DataFrame,
    *,
    recent_months: int = 3,
) -> dict[str, Any]:
    """Compute churn trend from file changes.

    Compares recent activity (last `recent_months` months) vs older activity.

    Returns:
        {
            "direction": "increasing" | "decreasing" | "stable",
            "recent_rate": float,  # commits per month in recent period
            "past_rate": float,    # commits per month in older period
            "ratio": float         # recent / past (>1 = increasing)
        }
    """
    if changes_df.empty:
        return {"direction": "stable", "recent_rate": 0, "past_rate": 0, "ratio": 1.0}

    ts_col = "commit_ts"
    if ts_col not in changes_df.columns:
        return {"direction": "stable", "recent_rate": 0, "past_rate": 0, "ratio": 1.0}

    col = changes_df[ts_col]
    if pd.api.types.is_numeric_dtype(col):
        dates = pd.to_datetime(col, unit="s", utc=True)
    else:
        dates = pd.to_datetime(col, utc=True)

    now = pd.Timestamp.now(tz=timezone.utc)
    cutoff = now - pd.DateOffset(months=recent_months)

    recent = (dates >= cutoff).sum()
    past = (dates < cutoff).sum()

    min_date = dates.min()
    max_date = dates.max()
    total_span_months = max((max_date - min_date).days / 30.0, 1)
    past_span_months = max((cutoff - min_date).days / 30.0, 1)

    recent_rate = recent / recent_months if recent_months > 0 else 0
    past_rate = past / past_span_months if past_span_months > 0 else 0

    if past_rate == 0:
        ratio = 2.0 if recent_rate > 0 else 1.0
    else:
        ratio = recent_rate / past_rate

    if ratio > 1.3:
        direction = "increasing"
    elif ratio < 0.7:
        direction = "decreasing"
    else:
        direction = "stable"

    return {
        "direction": direction,
        "recent_rate": round(recent_rate, 2),
        "past_rate": round(past_rate, 2),
        "ratio": round(ratio, 2),
    }


def compute_risk_factors(
    *,
    total_commits: int,
    churn_rate: float,
    churn_trend: dict,
    max_coupling: float,
    avg_coupling: float,
    coupled_files_count: int,
    bus_factor: int,
    top_author_share: float,
    age_days: int,
    repo_avg_commits: float = 50,
    repo_avg_churn: float = 20,
) -> dict[str, Any]:
    """Compute risk score with individual factor breakdown.

    Returns:
        {
            "risk_score": float (0-10),
            "risk_trend": float (delta based on churn trend),
            "risk_factors": [
                {"name": str, "score": float (0-10), "weight": float,
                 "label": str, "description": str},
                ...
            ]
        }
    """
    factors = []

    # 1. Churn rate factor (weight: 0.30)
    churn_norm = min(churn_rate / max(repo_avg_churn, 1), 3.0) / 3.0
    churn_score = round(churn_norm * 10, 1)
    churn_label = "High" if churn_score >= 7 else "Medium" if churn_score >= 4 else "Low"
    churn_multiplier = round(churn_rate / max(repo_avg_churn, 1), 1)
    factors.append({
        "name": "churn_rate",
        "score": churn_score,
        "weight": 0.30,
        "label": churn_label,
        "description": f"Churn rate is {churn_multiplier}x repo average",
    })

    # 2. Coupling factor (weight: 0.25)
    coupling_score = round(min(max_coupling * 10, 10), 1)
    coupling_label = "High" if coupling_score >= 7 else "Medium" if coupling_score >= 4 else "Low"
    factors.append({
        "name": "coupling",
        "score": coupling_score,
        "weight": 0.25,
        "label": coupling_label,
        "description": f"Max coupling {round(max_coupling, 2)} with {coupled_files_count} coupled files",
    })

    # 3. Bus factor (weight: 0.25)
    if bus_factor <= 1:
        bf_score = 9.0
    elif bus_factor == 2:
        bf_score = 6.0
    elif bus_factor == 3:
        bf_score = 3.0
    else:
        bf_score = 1.0
    bf_label = "High" if bf_score >= 7 else "Medium" if bf_score >= 4 else "Low"
    factors.append({
        "name": "bus_factor",
        "score": bf_score,
        "weight": 0.25,
        "label": bf_label,
        "description": f"Bus factor {bus_factor}, top contributor owns {round(top_author_share * 100)}%",
    })

    # 4. File age / stability (weight: 0.10)
    commit_freq = total_commits / max(age_days, 1) * 30  # commits per month
    freq_norm = min(commit_freq / max(repo_avg_commits / 30, 1), 3.0) / 3.0
    age_score = round(freq_norm * 10, 1)
    age_label = "High" if age_score >= 7 else "Medium" if age_score >= 4 else "Low"
    factors.append({
        "name": "file_age",
        "score": age_score,
        "weight": 0.10,
        "label": age_label,
        "description": f"File age {age_days} days, {round(commit_freq, 1)} commits/month",
    })

    # 5. Activity trend (weight: 0.10)
    trend_dir = churn_trend.get("direction", "stable")
    if trend_dir == "increasing":
        trend_score = 8.0
    elif trend_dir == "decreasing":
        trend_score = 2.0
    else:
        trend_score = 5.0
    trend_label = "High" if trend_score >= 7 else "Medium" if trend_score >= 4 else "Low"
    factors.append({
        "name": "activity_trend",
        "score": trend_score,
        "weight": 0.10,
        "label": trend_label,
        "description": f"Activity is {trend_dir} (ratio: {churn_trend.get('ratio', 1.0)}x)",
    })

    # Weighted total (scale to 0-100 to match frontend expectations)
    risk_score = sum(f["score"] * f["weight"] for f in factors)
    risk_score = float(round(min(risk_score * 10, 100), 1))

    # Risk trend (delta estimate based on churn trend)
    trend_ratio = churn_trend.get("ratio", 1.0)
    risk_trend = float(round((trend_ratio - 1.0) * risk_score * 0.3, 1))

    return {
        "risk_score": risk_score,
        "risk_trend": risk_trend,
        "risk_factors": factors,
    }


def detect_knowledge_silos(
    author_commits: dict[str, int],
    bus_factor: int,
    *,
    silo_threshold: float = 0.7,
) -> list[str]:
    """Detect knowledge silos -- authors with exclusive ownership.

    A file has a knowledge silo when:
    - An author owns >= silo_threshold of commits
    - Bus factor <= 2

    Returns list of silo author names.
    """
    if not author_commits or bus_factor > 2:
        return []

    total = sum(author_commits.values())
    if total == 0:
        return []

    silos = []
    for author, commits in author_commits.items():
        if commits / total >= silo_threshold:
            silos.append(author)
    return silos


def compute_coupling_timeline(
    storage: Storage,
    parquet_dir: Path,
    file_id: int,
    *,
    from_ts: int | None = None,
    to_ts: int | None = None,
    granularity: str = "monthly",
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Compute coupling evolution over time for a file.

    For each time bucket, finds files that co-changed with the target file
    and computes coupling metrics.

    Returns list of:
        {
            "date": str (bucket start),
            "coupled_files_count": int,
            "max_coupling_score": float,
            "avg_coupling_score": float,
            "new_couplings": int,
            "removed_couplings": int,
        }
    """
    target_changes = load_file_changes(parquet_dir, file_id, from_ts=from_ts, to_ts=to_ts)
    if target_changes.empty:
        return []

    target_oids = set(target_changes["commit_oid"].unique())
    if not target_oids:
        return []

    changes_path = parquet_dir / "changes.parquet"
    if not changes_path.exists():
        return []

    all_changes = ds.dataset(changes_path).to_table().to_pandas()
    co_changes = all_changes[all_changes["commit_oid"].isin(target_oids)]

    if co_changes.empty:
        return []

    co_changes = bucketize_ts(co_changes, "commit_ts", granularity)
    target_changes = bucketize_ts(target_changes, "commit_ts", granularity)

    target_buckets = target_changes.groupby("bucket")["commit_oid"].apply(set).to_dict()

    results = []
    prev_coupled_set: set[int] = set()

    for bucket in sorted(target_buckets.keys()):
        target_oids_in_bucket = target_buckets[bucket]
        target_commit_count = len(target_oids_in_bucket)

        bucket_co = co_changes[
            (co_changes["bucket"] == bucket)
            & (co_changes["file_id"] != file_id)
            & (co_changes["commit_oid"].isin(target_oids_in_bucket))
        ]

        if bucket_co.empty:
            results.append({
                "date": bucket,
                "coupled_files_count": 0,
                "max_coupling_score": 0.0,
                "avg_coupling_score": 0.0,
                "new_couplings": 0,
                "removed_couplings": len(prev_coupled_set),
            })
            prev_coupled_set = set()
            continue

        file_cochange = bucket_co.groupby("file_id")["commit_oid"].nunique()

        all_bucket_changes = co_changes[co_changes["bucket"] == bucket]
        file_total_in_bucket = all_bucket_changes.groupby("file_id")["commit_oid"].nunique()

        coupling_scores = {}
        for other_id, pair_count in file_cochange.items():
            other_count = file_total_in_bucket.get(other_id, pair_count)
            union = target_commit_count + other_count - pair_count
            coupling_scores[other_id] = pair_count / union if union > 0 else 0

        current_coupled_set = set(coupling_scores.keys())
        new_couplings = len(current_coupled_set - prev_coupled_set)
        removed_couplings = len(prev_coupled_set - current_coupled_set)

        scores = list(coupling_scores.values())
        results.append({
            "date": bucket,
            "coupled_files_count": len(scores),
            "max_coupling_score": round(max(scores) if scores else 0, 3),
            "avg_coupling_score": round(sum(scores) / len(scores) if scores else 0, 3),
            "new_couplings": new_couplings,
            "removed_couplings": removed_couplings,
        })
        prev_coupled_set = current_coupled_set

    return results


def compute_risk_timeline(
    storage: Storage,
    parquet_dir: Path,
    file_id: int,
    *,
    from_ts: int | None = None,
    to_ts: int | None = None,
    granularity: str = "monthly",
) -> list[dict[str, Any]]:
    """Compute risk score over time for a file.

    For each time bucket, computes a risk score based on churn, coupling,
    and author concentration in that period.

    Returns list of:
        {
            "date": str,
            "risk_score": float (0-10),
            "factors": {
                "churn_rate": float, "coupling": float,
                "bus_factor": float, "activity": float,
            }
        }
    """
    target_changes = load_file_changes(parquet_dir, file_id, from_ts=from_ts, to_ts=to_ts)
    if target_changes.empty:
        return []

    target_changes = bucketize_ts(target_changes, "commit_ts", granularity)

    commit_oids = target_changes["commit_oid"].unique().tolist()
    commits_df = load_commits_for_oids(parquet_dir, commit_oids)
    commit_author_map = {}
    if not commits_df.empty:
        commit_author_map = dict(zip(commits_df["commit_oid"], commits_df["author_name"]))

    changes_path = parquet_dir / "changes.parquet"
    all_changes = pd.DataFrame()
    if changes_path.exists():
        all_changes = ds.dataset(changes_path).to_table().to_pandas()
        all_changes = all_changes[all_changes["commit_oid"].isin(set(commit_oids))]
        if not all_changes.empty:
            all_changes = bucketize_ts(all_changes, "commit_ts", granularity)

    results = []
    for bucket, group in target_changes.groupby("bucket"):
        bucket_commits = len(group["commit_oid"].unique())
        bucket_oids = set(group["commit_oid"].unique())

        authors_in_bucket: dict[str, int] = defaultdict(int)
        for oid in bucket_oids:
            author = commit_author_map.get(oid, "Unknown")
            authors_in_bucket[author] += 1

        bf_result = compute_bus_factor(dict(authors_in_bucket))
        bus_factor = bf_result["bus_factor"]

        churn_score = min(bucket_commits / 5.0, 1.0)

        coupling_score_val = 0.0
        if not all_changes.empty:
            bucket_co = all_changes[
                (all_changes["bucket"] == bucket)
                & (all_changes["file_id"] != file_id)
                & (all_changes["commit_oid"].isin(bucket_oids))
            ]
            if not bucket_co.empty:
                co_file_count = bucket_co["file_id"].nunique()
                coupling_score_val = min(co_file_count / 10.0, 1.0)

        if bus_factor <= 1:
            bf_risk = 0.9
        elif bus_factor <= 2:
            bf_risk = 0.5
        else:
            bf_risk = 0.2

        risk = (
            churn_score * 0.35
            + coupling_score_val * 0.25
            + bf_risk * 0.25
            + (0.5 if bucket_commits > 3 else 0.2) * 0.15
        )
        risk_score = round(risk * 10, 1)

        results.append({
            "date": str(bucket),
            "risk_score": risk_score,
            "factors": {
                "churn_rate": round(churn_score * 10, 1),
                "coupling": round(coupling_score_val * 10, 1),
                "bus_factor": round(bf_risk * 10, 1),
                "activity": round(bucket_commits, 0),
            },
        })

    return results


def compute_ownership_timeline(
    changes_df: pd.DataFrame,
    commit_author_map: dict[str, str],
    granularity: str = "monthly",
) -> list[dict[str, Any]]:
    """Compute ownership distribution over time.

    Returns list of:
        {
            "date": str,
            "contributions": {"author_name": commit_count, ...}
        }
    """
    if changes_df.empty:
        return []

    df = bucketize_ts(changes_df, "commit_ts", granularity)

    results = []
    for bucket, group in df.groupby("bucket"):
        contribs: dict[str, int] = defaultdict(int)
        for oid in group["commit_oid"].unique():
            author = commit_author_map.get(oid, "Unknown")
            contribs[author] += 1
        results.append({
            "date": str(bucket),
            "contributions": dict(contribs),
        })

    return results


def get_repo_averages(storage: Storage) -> dict[str, float]:
    """Get repo-wide average metrics for normalization."""
    row = storage.conn.execute(
        """
        SELECT 
            AVG(CAST(json_extract(metadata_json, '$.total_commits') AS REAL)),
            AVG(CAST(json_extract(metadata_json, '$.total_lines_added') AS REAL) +
                CAST(json_extract(metadata_json, '$.total_lines_deleted') AS REAL))
        FROM entities 
        WHERE exists_at_head = 1 AND kind = 'file'
          AND metadata_json IS NOT NULL
        """
    ).fetchone()

    avg_commits = row[0] if (row and row[0] is not None) else 50
    avg_churn = row[1] if (row and row[1] is not None) else 20

    return {
        "avg_commits": float(avg_commits),
        "avg_churn": float(avg_churn),
    }
