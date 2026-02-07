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

### 1. Setup Backend (with all dependencies)
```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install all sub-projects in editable mode
python -m pip install -e .
```

### 2. Setup Frontend (with all dependencies)
```bash
cd src/frontend
npm install  # Installs React, Vite, TailwindCSS v4, D3, lucide-react, etc.
```

### 3. Run Development Servers

**Terminal 1 - Backend API:**
```bash
# Make sure venv is activated
source .venv/bin/activate

# Start FastAPI server with hot reload
python -m uvicorn code_intel.app:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend Dev Server:**
```bash
cd src/frontend
npm run dev  # Starts Vite dev server on http://localhost:5173
```

**Terminal 3 - Analyze a repository:**
```bash
# Activate venv if not already
source .venv/bin/activate

# Analyze a repository
# repo_id: unique identifier for the analysis
# data-dir: where artifacts will be stored
python -m git_analyzer analyze /path/to/repo --repo-id myrepo --data-dir data
```

Open <http://localhost:5173/> for the UI or <http://localhost:8000/docs> for API documentation.

### 4. Production Build

**Backend:**
```bash
# Backend runs directly with uvicorn (no build step needed)
python -m uvicorn code_intel.app:app --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd src/frontend
npm run build  # Builds optimized static files to dist/
npm run preview  # Preview production build locally
```

### Example with a public repo
```bash
# Clone and analyze
git clone https://github.com/octocat/Hello-World.git /tmp/hello-world

# Activate venv and analyze
source .venv/bin/activate
python -m git_analyzer analyze /tmp/hello-world --repo-id hello-world --data-dir data

# Start backend (Terminal 1)
python -m uvicorn code_intel.app:app --reload

# Start frontend (Terminal 2)
cd src/frontend && npm run dev
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
