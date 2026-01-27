# Logical File Coupling Analyzer (LFCA)

LFCA is a high-performance, artifact-first system for mining Git history to detect logical file coupling at scale.
It is designed for **very large repositories** and **long histories**, with a streaming ingestion pipeline and
sparse graphs to avoid pair explosion.

## Highlights
- **Streaming, incremental ingestion**: never loads entire history into memory.
- **Rename/move aware file identity**: stable `file_id` with lineage intervals.
- **Artifact-first storage**: Parquet datasets and small SQLite indexes for reproducible runs.
- **Sparse coupling graphs**: keeps only top-k edges per file for scalable visualization.
- **Folder filters on current tree**: includes files by current path while tracking historical moves.

## Quick start
```bash
# Create or update a mirror and analyze
lfca mirror /path/to/repo --data-dir data --repo-id myrepo
lfca analyze /path/to/repo --data-dir data --repo-id myrepo
```

## Output layout
Artifacts are stored under `data/repos/<repo_id>/artifacts/v1/`:
- `commits.parquet`, `changes.parquet`, `transactions.parquet`, `file_stats.parquet`
- `file_lineage.parquet` (move/rename lineage)
- `edges/edges_file_topk.parquet`, `edges/edges_folder.parquet`
- `indexes/` (SQLite mapping for path ↔ file_id)

## Notes on performance
- Commit parsing is streaming and uses `git log` with `-z` to avoid path parsing issues.
- Large commits are excluded or downweighted to limit pair explosion.
- Edge retention uses `top-k` per file to keep the graph sparse.

## Development
```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

