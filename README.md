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
pip install -e src/code-intel-interfaces -e src/platform -e src/git-analyzer \
            -e src/dep-analyzer -e src/semantic-analyzer -e src/project-intelligence
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

# Clone a repository first (if needed)
git clone https://github.com/owner/repo.git /path/to/local/repo

# Then trigger analysis via API (preferred method)
# Open http://localhost:5173 and use the UI to add and analyze repositories

# Or use the CLI directly (legacy method):
python -m git_analyzer analyze /path/to/local/repo --repo-id myrepo --data-dir data
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
# 1. Start backend (Terminal 1)
source .venv/bin/activate
python -m uvicorn code_intel.app:app --reload --host 0.0.0.0 --port 8000

# 2. Start frontend (Terminal 2)
cd src/frontend && npm run dev

# 3. Clone and analyze (Terminal 3)
git clone https://github.com/octocat/Hello-World.git /tmp/hello-world

# 4. Open http://localhost:5173 in browser
#    - Click "Add Repository" 
#    - Enter repo name: "hello-world"
#    - Enter path: "/tmp/hello-world"
#    - Click "Run Analysis" and select analyzers
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

### Initial Setup
```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install all packages in editable mode
pip install -e src/code-intel-interfaces -e src/platform -e src/git-analyzer \
            -e src/dep-analyzer -e src/semantic-analyzer -e src/project-intelligence

# Install frontend dependencies
cd src/frontend && npm install && cd ../..
```

### Running Tests

**Quick End-to-End Test (One Command):**
```bash
# Make sure backend and frontend servers are running first!
# Then install test dependencies and run the complete E2E test:
source .venv/bin/activate && pip install requests && python tests/test_e2e_analysis.py
```

This will:
- Check if servers are running
- Create a test repository with random name
- Run git analysis
- Verify all API endpoints
- Automatically cleanup test data

**Other Tests:**
```bash
# Backend unit tests
source .venv/bin/activate
pytest tests/

# Quick backend health check
python tests/test_quick_check.py

# API functionality tests
python tests/test_api_fixes.py

# Frontend tests (if configured)
cd src/frontend
npm test
```

**Prerequisites for E2E test:**
1. Backend server must be running: `python -m uvicorn code_intel.app:app --reload --host 0.0.0.0 --port 8000`
2. Frontend server must be running: `cd src/frontend && npm run dev`

### Troubleshooting

**Analyzer not registering:**
If you see `Unknown analyzer: git` errors, reinstall packages:
```bash
pip install --force-reinstall -e src/git-analyzer -e src/platform \
            -e src/code-intel-interfaces
```

**Import errors:**
Ensure all packages are installed in editable mode and the virtual environment is activated.

**Server won't start:**
Check that port 8000 is not already in use:
```bash
lsof -i :8000  # Find process using port 8000
kill <PID>     # Kill the process if needed
python -m venv .venv
source .venv/bin/activate
python -m pip install -e .
```
