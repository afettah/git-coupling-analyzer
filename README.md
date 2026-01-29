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
### Requirements
- Python 3.10+
- Node.js 18+ & npm (for visualization)
- Git (for analyzing repositories)

### 1. Setup Backend
```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[all]"
```

### 2. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```

### 3. Run Analysis & Start API
In a new terminal (with venv activated):
```bash
# Analyze a repository
python -m lfca analyze /path/to/repo --data-dir data --repo-id myrepo

# Start the API server
python -m uvicorn lfca.api:app --reload
```

Open <http://localhost:5173/> (the Vite dev server) or <http://localhost:8000/> (for the API docs/legacy static UI).

### Example with a public repo
```bash
# Clone and analyze
git clone https://github.com/octocat/Hello-World.git /tmp/hello-world
python -m lfca analyze /tmp/hello-world --data-dir data --repo-id hello-world

# Run servers
python -m uvicorn lfca.api:app --reload &
cd frontend && npm run dev
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
python -m pip install -e .
```
