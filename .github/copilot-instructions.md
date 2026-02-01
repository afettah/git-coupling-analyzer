# LFCA - AI Coding Agent Instructions

## Project Overview
LFCA (Logical File Coupling Analyzer) discovers hidden file dependencies by mining git history co-change patterns. It's a full-stack application with a Python backend (FastAPI + Parquet/SQLite) and React/TypeScript frontend (D3 visualizations).

## Architecture
```
lfca/              # Python backend - coupling analysis engine
├── api.py         # FastAPI endpoints (entry: uvicorn lfca.api:app)
├── extract.py     # Git history → Parquet via streaming `git log`
├── edges.py       # Pair counting, Jaccard/conditional probability metrics
├── storage.py     # Unified Parquet + SQLite access layer
├── clustering/    # Plugin-based algorithms (louvain, dbscan, hierarchical)
│   ├── base.py    # ClusterAlgorithm ABC - implement this for new algorithms
│   └── registry.py # @register decorator auto-registers algorithms

frontend/src/      # React + Vite + TailwindCSS v4
├── api.ts         # Axios client with global error interceptor
├── components/
│   └── shared/    # Reusable UI primitives (Button, Card, Modal, etc.)
├── design-tokens/ # Theme values (colors, spacing, typography)
└── hooks/         # useDebounce, useLocalStorage, useClickOutside
```

## Key Data Flow
1. **Mirror** → bare git clone under `data/repos/<repo_id>/mirror.git`
2. **Extract** → stream `git log` to `commits.parquet`, `changes.parquet`, `transactions.parquet`
3. **Edge Build** → count file pairs, compute Jaccard/conditional probabilities
4. **Cluster** → graph algorithms group coupled files into logical modules
5. **Visualize** → D3 force graphs, folder trees, coupling tables

## Development Commands
```bash
# Backend
python -m pip install -e ".[all]"     # Install with all deps (api, clustering)
python -m uvicorn lfca.api:app --reload

# Frontend  
cd frontend && npm install && npm run dev  # Vite at :5173

# Analyze a repo
python -m lfca analyze /path/to/repo --data-dir data --repo-id myrepo

# Tests
pytest tests/                          # Run from project root
```

## Code Patterns & Conventions

### Backend (Python)
- **Storage**: Access via `Storage(paths.db_path, paths.parquet_dir)` - handles both Parquet and SQLite
- **New clustering algorithm**: Subclass `ClusterAlgorithm` in `lfca/clustering/`, add `@register` decorator
- **API models**: Use Pydantic BaseModel, keep in `lfca/api.py`

### Frontend (TypeScript/React)
- **Path alias**: Use `@/` prefix (e.g., `import { cn } from '@/lib/utils'`)
- **Styling**: TailwindCSS v4 with slate color palette (950 bg, 400 text, sky-500 accent)
- **Class merging**: Use `cn()` utility, not template literals
- **Components**: Generate new shared components via `./scripts/generate-component.sh ComponentName`
- **Icons**: Use `lucide-react` exclusively
- **API calls**: Functions in `frontend/src/api.ts` with proper types

### File Organization
- Feature components: `frontend/src/components/<feature>/`
- Shared primitives: `frontend/src/components/shared/` (export via `index.ts`)
- Hooks: `frontend/src/hooks/` with barrel export

## Important Metrics (edges table)
| Metric | Meaning |
|--------|---------|
| `jaccard` | Set overlap: how exclusively files change together |
| `p_dst_given_src` | If src changes, probability dst also changes |
| `p_src_given_dst` | Reverse conditional probability |
| `pair_count` | Raw co-occurrence count (weighted by changeset) |

## Data Artifacts Location
Analyzed repos stored at: `data/repos/<repo_id>/`
- `mirror.git` - bare git clone
- `lfca.sqlite` - file index, edges, clusters
- `parquet/` - commits, changes, transactions

## Common Tasks
- **Add API endpoint**: Define Pydantic model + route in `lfca/api.py`
- **Add clustering algo**: Create file in `lfca/clustering/`, subclass `ClusterAlgorithm`, use `@register`
- **Add UI component**: Use generator script or follow `shared/Button.tsx` pattern
- **Debug coupling**: Check `transactions.parquet` for changeset grouping, `edges` table for metrics
