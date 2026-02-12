from __future__ import annotations

import argparse
import logging
from pathlib import Path

from code_intel.config import RepoPaths
from code_intel.logging_utils import setup_logging
from git_analyzer.edges import EdgeBuilder
from git_analyzer.extract import HistoryExtractor
from git_analyzer.config import CouplingConfig


def _cmd_analyze(args: argparse.Namespace) -> None:
    paths = RepoPaths(Path(args.data_dir), args.repo_id)
    paths.ensure_dirs()
    
    # Setup logging to the repo's artifacts directory
    setup_logging(log_file=paths.db_path.parent / "analysis.log", verbose=args.verbose)
    logger = logging.getLogger(__name__)
    
    config = CouplingConfig(
        max_changeset_size=args.max_changeset_size,
        min_cooccurrence=args.min_cooccurrence,
        topk_edges_per_file=args.topk_edges_per_file,
    )

    logger.info(f"Starting analysis for {args.repo_id}")
    
    # Extraction phase
    extractor = HistoryExtractor(paths, config)
    try:
        extractor.run(since=args.since, until=args.until)
    finally:
        extractor.close()

    # Edge building phase
    builder = EdgeBuilder(paths, config)
    try:
        builder.build()
    finally:
        builder.close()
    
    logger.info("Analysis complete")


def build_parser() -> argparse.ArgumentParser:
    parent_parser = argparse.ArgumentParser(add_help=False)
    parent_parser.add_argument("--data-dir", default="data", help="Root data directory")
    parent_parser.add_argument("--repo-id", required=True, help="Unique repository ID")
    parent_parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")

    parser = argparse.ArgumentParser(description="Git Coupling Analyzer CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    analyze = subparsers.add_parser(
        "analyze", help="Extract history and calculate coupling", parents=[parent_parser]
    )
    analyze.add_argument("--since", help="Analyze since date (e.g. '2023-01-01')", default=None)
    analyze.add_argument("--until", help="Analyze until date", default=None)
    analyze.add_argument("--max-changeset-size", type=int, default=50, help="Skip commits with more changes")
    analyze.add_argument("--min-cooccurrence", type=int, default=3, help="Minimum shared commits for a pair")
    analyze.add_argument("--topk-edges-per-file", type=int, default=50, help="Keep top K edges per file")
    analyze.set_defaults(func=_cmd_analyze)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    
    # Initialize basic logging
    logging.basicConfig(level=logging.INFO if not args.verbose else logging.DEBUG)
    
    args.func(args)


if __name__ == "__main__":
    main()
