# API Test Results Summary

**Collection Time:** 2026-01-31T22:14:56.269252
**Repository:** openhands
**API Base URL:** http://localhost:8000

---

## 1. Repository Info

- **State:** complete
- **File Count:** 1,462
- **Commit Count:** 5,844
- **Folders at depth_1:** 11
- **Folders at depth_2:** 38
- **Folders at depth_3:** 72

## 2. File Information

- **Current Files (limited):** 454
- **With Deleted (limited):** 500
- **openhands/ folder:** 137
- **frontend/ folder:** 172
- **tests/ folder:** 49

### Top 10 Hottest Files

| File | Commits |
|------|---------|
| pyproject.toml | 71 |
| frontend/package-lock.json | 61 |
| frontend/package.json | 61 |
| containers/dev/compose.yml | 50 |
| docker-compose.yml | 45 |
| README.md | 20 |
| openhands/runtime/impl/kubernetes/README.md | 18 |
| poetry.lock | 16 |
| frontend/src/i18n/translation.json | 9 |
| openhands/server/routes/manage_conversations.py | 8 |

## 3. Coupling Analysis

### frontend/package.json

| Coupled File | Jaccard | Pair Count |
|--------------|---------|------------|
| frontend/package-lock.json | 0.9365 | 59.0 |
| containers/dev/compose.yml | 0.8197 | 50.0 |
| pyproject.toml | 0.7703 | 57.0 |
| docker-compose.yml | 0.6935 | 43.0 |
| openhands/runtime/impl/kubernetes/README.md | 0.2951 | 18.0 |

### frontend/package-lock.json

| Coupled File | Jaccard | Pair Count |
|--------------|---------|------------|
| frontend/package.json | 0.9365 | 59.0 |
| containers/dev/compose.yml | 0.8197 | 50.0 |
| pyproject.toml | 0.7467 | 56.0 |
| docker-compose.yml | 0.6935 | 43.0 |
| openhands/runtime/impl/kubernetes/README.md | 0.2951 | 18.0 |

### poetry.lock

| Coupled File | Jaccard | Pair Count |
|--------------|---------|------------|
| pyproject.toml | 0.1622 | 12.0 |

### pyproject.toml

| Coupled File | Jaccard | Pair Count |
|--------------|---------|------------|
| frontend/package.json | 0.7703 | 57.0 |
| frontend/package-lock.json | 0.7467 | 56.0 |
| containers/dev/compose.yml | 0.7143 | 50.0 |
| docker-compose.yml | 0.6056 | 43.0 |
| openhands/runtime/impl/kubernetes/README.md | 0.2571 | 18.0 |

### frontend/src/i18n/translation.json

| Coupled File | Jaccard | Pair Count |
|--------------|---------|------------|
| frontend/src/i18n/declaration.ts | 0.6667 | 6.0 |

### frontend/src/i18n/declaration.ts

| Coupled File | Jaccard | Pair Count |
|--------------|---------|------------|
| frontend/src/i18n/translation.json | 0.6667 | 6.0 |

### openhands/llm/llm.py

### openhands/controller/agent_controller.py

### openhands/runtime/base.py

### openhands/server/session/session.py

### tests/unit/test_agent_controller.py

### tests/unit/test_config.py

## 4. Coupling Evidence

### frontend/package.json ↔ frontend/package-lock.json

### poetry.lock ↔ pyproject.toml

### frontend/src/i18n/translation.json ↔ frontend/src/i18n/declaration.ts

### containers/dev/compose.yml ↔ docker-compose.yml

### Development.md ↔ containers/dev/compose.yml

## 5. Clustering Results

**Available Algorithms:** components, louvain, label_propagation, hierarchical, dbscan

### Louvain
- **Cluster Count:** 280

| Cluster ID | Size | Avg Coupling |
|------------|------|--------------|
| 1 | 2 | 0.6667 |
| 2 | 1 | 0.0000 |
| 3 | 1 | 0.0000 |
| 4 | 1 | 0.0000 |
| 5 | 1 | 0.0000 |

### Spectral
- **Error:** 500 Server Error: Internal Server Error for url: http://localhost:8000/repos/openhands/clustering/run

### Hierarchical
- **Cluster Count:** 1

| Cluster ID | Size | Avg Coupling |
|------------|------|--------------|
| 1 | 281 | 0.6667 |

## 6. Component Coupling

### openhands

### frontend

### tests

### evaluation

### enterprise

### openhands/server

### openhands/runtime

| Component | Jaccard | File Pairs |
|-----------|---------|------------|
| pyproject.toml | 0.2571 | 1 |

### frontend/src

## 7. Analysis Status

- **run_id:** 036385f97b87
- **state:** complete
- **config:** {'min_revisions': 5, 'max_changeset_size': 50, 'changeset_mode': 'by_commit', 'author_time_window_hours': 24, 'ticket_id_pattern': None, 'max_logical_changeset_size': 100, 'min_cooccurrence': 5, 'component_depth': 2, 'min_component_cooccurrence': 5, 'window_days': None, 'decay_half_life_days': None, 'topk_edges_per_file': 50}
- **git_head_oid:** 11c87caba40225e7bf727e6d3f16391c5dac4838
- **commit_count:** 5844
- **file_count:** 1462
- **edge_count:** 410
- **started_at:** 2026-01-31T19:57:36.133542
- **finished_at:** 2026-01-31T19:57:38.402500
- **error:** None
- **created_at:** 2026-01-31T19:57:36.132439
