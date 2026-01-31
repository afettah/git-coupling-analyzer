# API Validation Report

**Repository:** openhands
**Pass Rate:** 11/33 (33.3%)

## Results

| Check | Status | Expected | Actual | Details |
|-------|--------|----------|--------|---------|
| Current Files Count | ❌ | 2765 | 454 | Files should match within tolerance |
| Top 5 Hotspots Overlap | ❌ | ≥80% overlap | 60% (3/5) | Common files: {'frontend/package.json',  |
| Top 10 Hotspots Overlap | ❌ | ≥70% overlap | 60% (6/10) | Missing from API: {'openhands/controller |
| Commit Count: pyproject.toml | ❌ | 446 | 71 | Tolerance: ±45 |
| Commit Count: frontend/package-lock.json | ❌ | 525 | 61 | Tolerance: ±52 |
| Commit Count: frontend/package.json | ❌ | 522 | 61 | Tolerance: ±52 |
| Commit Count: README.md | ❌ | 251 | 20 | Tolerance: ±25 |
| Commit Count: poetry.lock | ❌ | 748 | 16 | Tolerance: ±75 |
| Commit Count: frontend/src/i18n/translat | ❌ | 244 | 9 | Tolerance: ±24 |
| Commit Count: openhands/server/routes/ma | ❌ | 119 | 8 | Tolerance: ±12 |
| Coupling: frontend/package.json ↔ fronte | ✅ | Jaccard ≥ 0.90 | 0.9365 | High coupling pair should be detected |
| Coupling: poetry.lock ↔ pyproject.toml | ❌ | Jaccard ≥ 0.50 | 0.1622 | High coupling pair should be detected |
| Coupling: frontend/src/i18n/translation. | ✅ | Jaccard ≥ 0.80 | 0.6667 | High coupling pair should be detected |
| Clustering louvain: Cluster Count | ✅ | 5-500 clusters | 280 | Should produce meaningful clusters |
| Clustering louvain: Avg Cluster Size | ❌ | ≥2 files/cluster | 1.0 | Range: 1-2 |
| Clustering louvain: Has Insights | ✅ | avg_coupling > 0 | True | Clusters should have coupling metrics |
| Clustering: spectral | ❌ | clusters | 500 Server Error: Internal Ser | Algorithm failed |
| Clustering hierarchical: Cluster Count | ❌ | 5-500 clusters | 1 | Should produce meaningful clusters |
| Clustering hierarchical: Avg Cluster Siz | ✅ | ≥2 files/cluster | 281.0 | Range: 281-281 |
| Clustering hierarchical: Has Insights | ✅ | avg_coupling > 0 | True | Clusters should have coupling metrics |
| Component Coupling: openhands → tests | ❌ | tests in coupled list | [] | Components should show cross-module coup |
| Component Coupling: openhands → frontend | ❌ | frontend in coupled list | [] | Components should show cross-module coup |
| Component Coupling: frontend → openhands | ❌ | openhands in coupled list | [] | Components should show cross-module coup |
| Evidence: File IDs for frontend/package. | ✅ | both file IDs found | src=135, dst=134 | Files should be resolved to IDs |
| Evidence: Commits for frontend/package.j | ❌ | >0 common commits | 0 | High-coupling pairs should have evidence |
| Evidence: File IDs for poetry.lock↔pypro | ✅ | both file IDs found | src=129, dst=130 | Files should be resolved to IDs |
| Evidence: Commits for poetry.lock↔pyproj | ❌ | >0 common commits | 0 | High-coupling pairs should have evidence |
| Evidence: File IDs for frontend/src/i18n | ✅ | both file IDs found | src=65, dst=64 | Files should be resolved to IDs |
| Evidence: Commits for frontend/src/i18n/ | ❌ | >0 common commits | 0 | High-coupling pairs should have evidence |
| Evidence: File IDs for containers/dev/co | ✅ | both file IDs found | src=132, dst=133 | Files should be resolved to IDs |
| Evidence: Commits for containers/dev/com | ❌ | >0 common commits | 0 | High-coupling pairs should have evidence |
| Evidence: File IDs for Development.md↔co | ✅ | both file IDs found | src=9, dst=132 | Files should be resolved to IDs |
| Evidence: Commits for Development.md↔con | ❌ | >0 common commits | 0 | High-coupling pairs should have evidence |