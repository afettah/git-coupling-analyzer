from __future__ import annotations

import argparse
from pathlib import Path

from lfca.config import RepoPaths
from lfca.edges import EdgeBuilder, EdgeConfig
from lfca.extract import ExtractConfig, HistoryExtractor
from lfca.mirror import mirror_repo


def _iter_transactions_from_parquet(
    paths: RepoPaths,
    merge_policy: str = "include",
    merge_downweight: float = 0.5,
):
    import pyarrow.parquet as pq

    def commit_weights() -> dict[str, float]:
        if merge_policy == "include":
            return {}
        commits_path = paths.artifacts_root / "commits.parquet"
        if not commits_path.exists():
            return {}
        commits_table = pq.read_table(commits_path, columns=["commit_oid", "is_merge"])
        weights: dict[str, float] = {}
        for commit_oid, is_merge in zip(
            commits_table.column(0).to_pylist(), commits_table.column(1).to_pylist()
        ):
            if not is_merge:
                continue
            if merge_policy == "exclude":
                weights[commit_oid] = 0.0
            elif merge_policy == "downweight":
                weights[commit_oid] = merge_downweight
        return weights

    merge_weights = commit_weights()

    parquet_file = pq.ParquetFile(paths.artifacts_root / "transactions.parquet")
    current_commit = None
    current_files: list[int] = []

    for batch in parquet_file.iter_batches(columns=["commit_oid", "file_id"]):
        commit_oids = batch.column(0).to_pylist()
        file_ids = batch.column(1).to_pylist()
        for commit_oid, file_id in zip(commit_oids, file_ids):
            if current_commit is None:
                current_commit = commit_oid
            if commit_oid != current_commit:
                weight = merge_weights.get(current_commit, 1.0)
                if weight:
                    yield (current_files, weight) if weight != 1.0 else current_files
                current_commit = commit_oid
                current_files = []
            current_files.append(int(file_id))

    if current_files:
        weight = merge_weights.get(current_commit, 1.0)
        if weight:
            yield (current_files, weight) if weight != 1.0 else current_files


def _cmd_mirror(args: argparse.Namespace) -> None:
    mirror_repo(Path(args.repo_path), RepoPaths(Path(args.data_dir), args.repo_id))


def _cmd_analyze(args: argparse.Namespace) -> None:
    repo_path = Path(args.repo_path)
    paths = RepoPaths(Path(args.data_dir), args.repo_id)
    mirror_repo(repo_path, paths)

    extractor = HistoryExtractor(
        repo_path,
        paths,
        ExtractConfig(
            max_files_per_commit=args.max_files_per_commit,
            bulk_policy=args.bulk_policy,
            merge_policy=args.merge_policy,
            parallel_postprocessing=args.parallel_postprocessing,
        ),
    )
    extractor.run(since=args.since, until=args.until)

    transactions = _iter_transactions_from_parquet(
        paths, merge_policy=args.merge_policy, merge_downweight=args.merge_downweight
    )
    EdgeBuilder(
        paths,
        EdgeConfig(
            max_files_per_commit=args.max_files_per_commit,
            bulk_policy=args.bulk_policy,
            topk_edges_per_file=args.topk_edges_per_file,
            merge_policy=args.merge_policy,
            merge_downweight=args.merge_downweight,
        ),
    ).build(transactions)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Logical File Coupling Analyzer")
    parser.add_argument("--data-dir", default="data", help="Directory for LFCA artifacts")
    parser.add_argument("--repo-id", required=True, help="Repository id")

    subparsers = parser.add_subparsers(dest="command", required=True)

    mirror = subparsers.add_parser("mirror", help="Create or update a mirror")
    mirror.add_argument("repo_path", help="Path to repository")
    mirror.set_defaults(func=_cmd_mirror)

    analyze = subparsers.add_parser("analyze", help="Analyze a repository")
    analyze.add_argument("repo_path", help="Path to repository")
    analyze.add_argument("--since", help="Analyze since date", default=None)
    analyze.add_argument("--until", help="Analyze until date", default=None)
    analyze.add_argument("--max-files-per-commit", type=int, default=300)
    analyze.add_argument("--bulk-policy", choices=["exclude", "downweight"], default="downweight")
    analyze.add_argument("--topk-edges-per-file", type=int, default=50)
    analyze.add_argument(
        "--merge-policy",
        choices=["include", "exclude", "downweight"],
        default="include",
    )
    analyze.add_argument("--merge-downweight", type=float, default=0.5)
    analyze.add_argument("--parallel-postprocessing", action="store_true")
    analyze.set_defaults(func=_cmd_analyze)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
