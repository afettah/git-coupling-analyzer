# Improvement Suggestions for LFCA

This document proposes enhancements for the Logical File Coupling Analyzer to improve usability, analysis quality, and system performance. It is organized as a backlog of ideas grouped by feature area.

---

## 0. Product Goals

- **Trust**: explainable coupling, clear provenance, and repeatable results.
- **Speed**: fast initial scans and quick incremental updates.
- **Actionability**: surface what to refactor next, not just raw graphs.
- **Adoption**: easy web ui, useful defaults, and low setup friction.

---

## 1. Core Features (Coupling & Clusters)

### 1.1 Save & Reopen Clustering Results
- Save clustering snapshots to disk (JSON + Parquet metadata).
- Reopen snapshots without recomputing.
- Export: single cluster, all clusters, CSV/JSON/GraphML.
- Attach run metadata: repo SHA, LFCA version, parameters.

### 1.2 Explain Coupling (Why is this edge strong?)
- On edge click, show top contributing commits with weights.
- Show commit message snippets and timestamps.
- Breakdown by time window (last 30/90/365 days).
- Show coupling score formula inputs (shared commits, weights).

### 1.3 Cluster Insights
- Cluster summary: size, churn, average coupling, hot files.
- List top commits per cluster and common authors.
- “Refactor hints”: candidate modules, split points, ownership.
- Compare clusters across snapshots (growth/shrink, drift).

### 1.4 Coupling Quality Controls
- Minimum file size/LOC threshold.
- Exclude generated files (vendor, build, dist, snapshots).
- Ignore rules via `.lfcaignore` (extends `.gitignore`).
- File type filters (only `*.py`, `*.ts`, etc.).

---

## 2. UI & UX Enhancements

### 2.1 Impact Graph
- Define and document the feature: “files impacted by selected file(s)”.
- Provide default inputs (time window, min weight, depth).
- Show validation hints for accepted values and examples.
- Add “no data” states with suggested parameter fixes.

### 2.2 Folder Tree
- Allow file/folder history view and last-change info.
- Show coupled files for a folder (aggregate coupling).
- Add filters: stable files, high churn, recently changed.
- Advanced filters: by author, by file type, by time window.

### 2.3 Graph View
- Use interactive graph libraries (Sigma.js, Cytoscape).
- Click to open file, highlight neighbors, pin nodes.
- Zoom/fit, lasso selection, and cluster collapse/expand.
- Visual encodings: edge weight thickness, node churn size.

### 2.4 Dashboard Cards
- “Top risky pairs”, “Newest coupling”, “Churn hotspots”.
- Trend arrows vs last snapshot.
- Quick actions: export, open in graph, create cluster view.

---

## 3. Analysis Quality

### 3.1 Trend Detection (Hotspots)
- Velocity of coupling: is $w_{A,B}$ rising or falling.
- Rising stars vs legacy coupling.
- Show decay-weighted coupling (recent commits weigh more).

### 3.2 Multi-Signal Scoring
- Combine coupling with churn, ownership, file size.
- Add “risk score” for refactor prioritization.
- Include rename tracking (git similarity detection).

### 3.3 Temporal & Slice Analysis
- Compare coupling per release/tag or sprint window.
- Diff two snapshots: new edges, removed edges, moved files.
- “What changed since last release?” report.

### 3.4 Path & Semantic Grouping
- Group by folder, package, or module.
- Merge related files (e.g., `*.test.*` with source file).
- Allow user-defined grouping rules (YAML config).

---

## 4. Performance & Scalability

### 4.1 Polars over Pandas
- Replace data processing in extract/edges with Polars.
- Use lazy execution and streaming for large logs.

### 4.2 DuckDB Query Layer
- Query Parquet directly (no full load).
- Provide SQL for filters, top-K, and time windows.

### 4.3 Incremental Extraction
- Store `last_processed_commit_sha`.
- Process `git log last_sha..HEAD` only.
- Append transactions to partitioned Parquet paths.

### 4.4 Parallel Graph Algorithms
- Use `igraph` or `rustworkx` for Louvain/Leiden.
- Enable multiprocessing for edge generation.

### 4.5 Approximate Similarity
- Use MinHash/LSH for huge repositories.
- Provide “approx mode” toggle with accuracy estimate.

---

## 5. API, CLI, and DX

### 5.1 CLI Enhancements
- Profiles: `fast`, `balanced`, `deep` presets.
- Dry-run validation of parameters.
- Auto-detect repo root and sensible defaults.

### 5.2 REST & File Exports
- Export endpoints: clusters, edges, time-sliced metrics.
- Stable schema versioning for API responses.
- CSV/JSON/GraphML exports from UI and CLI.

### 5.3 Reproducibility
- Save and load run config (`.lfcarun.yml`).
- Persist environment metadata (LFCA, Python, OS).
- Deterministic ordering of outputs.

---

## 6. Reliability & Operations

### 6.1 Data Validation
- Validate input repo (clean state vs dirty state warning).
- Show missing data warnings (e.g., no commits in window).

### 6.2 Observability
- Structured logs with timings by stage.
- Export metrics (counts, durations, cache hit rate).

### 6.3 Caching
- Cache parsed git log and file maps.
- Cache clustering results per config hash.

---

## 7. Security & Privacy

- Allow redaction of commit messages (hash-only mode).
- Support anonymized author IDs.
- Optional local-only mode with no network calls.

---

## 8. Testing & Quality

- Snapshot tests for clustering stability.
- Golden datasets for regression coverage.
- Benchmarks for large repos (performance budgets).

---

## 9. Future Ideas

- IDE plugin integration for “coupled files” hints.
- Refactor simulations: “if we split file X, impact?”.
- Ownership maps and bus-factor scoring.
- CI integration: fail on rising coupling thresholds.
