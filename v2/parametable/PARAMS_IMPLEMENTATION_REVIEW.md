# V2 Implementation Review Report

> **Date:** 2026-02-07  
> **Scope:** Full review of `src/` implementation — parameters, git options, limits, chunking, accuracy & performance issues  
> **Note:** This codebase is AI-generated; findings below are based on manual code audit.

---

## Table of Contents

1. [Parameter Inventory](#1-parameter-inventory)
2. [Git Options & Commands](#2-git-options--commands)
3. [Limits, Thresholds & Chunking](#3-limits-thresholds--chunking)
4. [Issues & Improvements](#4-issues--improvements)

---

## 1. Parameter Inventory

### 1.1 All Parameters — Full Registry

| # | Parameter Name | File Path | Category | Default | Parametrable? | Notes |
|---|---------------|-----------|----------|---------|---------------|-------|
| 1 | `min_revisions` | `git_analyzer/config.py:13` | Filter | `5` | ✅ Declared but **never used** in code | Dead parameter — see issue #1 |
| 2 | `max_changeset_size` | `git_analyzer/config.py:14` | Filter | `50` | ✅ Yes | Used in extract.py:102 AND changesets.py:40 (double filtering) |
| 3 | `changeset_mode` | `git_analyzer/config.py:17` | Grouping | `"by_commit"` | ✅ Yes | `by_commit` \| `by_author_time` \| `by_ticket_id` |
| 4 | `author_time_window_hours` | `git_analyzer/config.py:18` | Grouping | `24` | ✅ Yes | Only for `by_author_time` mode |
| 5 | `ticket_id_pattern` | `git_analyzer/config.py:19` | Grouping | `None` | ✅ Yes | Regex, required for `by_ticket_id` |
| 6 | `max_logical_changeset_size` | `git_analyzer/config.py:22` | Filter | `100` | ✅ Yes | Used in `by_author_time` and `by_ticket_id` only |
| 7 | `min_cooccurrence` | `git_analyzer/config.py:25` | Edge | `5` | ✅ Yes | Minimum pair co-change count for edge |
| 8 | `component_depth` | `git_analyzer/config.py:28` | Component | `2` | ✅ Yes | Folder depth for component-level aggregation |
| 9 | `min_component_cooccurrence` | `git_analyzer/config.py:29` | Component | `5` | ✅ Declared but **never used** | Dead parameter — see issue #2 |
| 10 | `window_days` | `git_analyzer/config.py:32` | Time | `None` | ✅ Declared but **never used** | Dead parameter — see issue #3 |
| 11 | `decay_half_life_days` | `git_analyzer/config.py:33` | Time | `None` | ✅ Declared but **never used** | Dead parameter — see issue #4 |
| 12 | `topk_edges_per_file` | `git_analyzer/config.py:36` | Edge | `50` | ✅ Yes | Top-K edges retained per file |
| 13 | `validation_mode` | `git_analyzer/config.py:39` | Parsing | `SOFT` | ✅ Yes | `strict` \| `soft` \| `permissive` |
| 14 | `max_validation_issues` | `git_analyzer/config.py:40` | Parsing | `200` | ✅ Yes | Cap for in-memory issue samples |
| 15 | `since` | `git_analyzer/git.py:144` | Time | `None` | ✅ Via CLI/API | Git `--since` filter |
| 16 | `until` | `git_analyzer/git.py:145` | Time | `None` | ✅ Via CLI/API | Git `--until` filter |
| 17 | `ref` | `git_analyzer/git.py:146` | Git | `"HEAD"` | ⚠️ Hardcoded in extract, not exposed | Should be parametrable |
| 18 | `all_refs` | `git_analyzer/git.py:147` | Git | `False` | ⚠️ Hardcoded `False`, not exposed | Important for multi-branch analysis |
| 19 | `chunk_size` | `git_analyzer/git.py:128` | Performance | `1 << 20` (1MB) | ❌ Hardcoded | Stream read buffer size |
| 20 | `--find-renames` | `git_analyzer/git.py:173` | Git | `60%` | ❌ Hardcoded | Rename detection threshold |
| 21 | `limit` (coupling) | `git_analyzer/api.py:41` | API | `50` | ✅ Yes | Per-file coupling query limit |
| 22 | `min_weight` (coupling) | `git_analyzer/api.py:39` | API | `0.0` | ✅ Yes | Minimum coupling weight filter |
| 23 | `limit` (graph) | `git_analyzer/api.py:82` | API | `200` | ✅ Yes | Coupling graph edge limit |
| 24 | `limit` (hotspots) | `git_analyzer/api.py:271` | API | `50` | ✅ Yes | Hotspot result limit |
| 25 | `sort_by` (hotspots) | `git_analyzer/api.py:272` | API | `"risk_score"` | ✅ Yes | Hotspot sort field |
| 26 | `points` (timeline) | `git_analyzer/api.py:594` | API | `12` | ✅ Yes | Timeline data points |
| 27 | `granularity` (timeline) | `git_analyzer/api.py:595` | API | `"monthly"` | ✅ Yes | `monthly` \| `weekly` \| `daily` |
| 28 | `limit` (files list) | `routers/git.py:263` | API | `5000` | ✅ Yes | File listing limit |
| 29 | `limit` (edges export) | `routers/git.py:78` | API | `500` | ✅ Yes | Raw edges export limit |
| 30 | `limit` (authors) | `git_analyzer/api.py:572` | API | `50` | ✅ Yes | Author stats limit |
| 31 | `limit` (file commits) | `routers/git.py:475` | API | `100` | ✅ Yes | Per-file commit list |
| 32 | `resolution` (louvain) | `clustering/louvain.py:18` | Clustering | `1.0` | ✅ Yes | Louvain resolution |
| 33 | `eps` (dbscan) | `clustering/dbscan.py:17` | Clustering | `0.5` | ✅ Yes | DBSCAN epsilon |
| 34 | `min_samples` (dbscan) | `clustering/dbscan.py:22` | Clustering | `2` | ✅ Yes | DBSCAN min samples |
| 35 | `n_clusters` (hierarchical) | `clustering/hierarchical.py:17` | Clustering | `10` (fallback) | ✅ Yes | Number of clusters |
| 36 | `distance_threshold` (hier.) | `clustering/hierarchical.py:21` | Clustering | `None` | ✅ Yes | Cut threshold |
| 37 | `linkage` (hierarchical) | `clustering/hierarchical.py:24` | Clustering | `"average"` | ✅ Yes | `ward`\|`complete`\|`average`\|`single` |
| 38 | `min_weight` (clustering) | `clustering/*.py` | Clustering | `0.0`–`0.1` | ✅ Yes | Clustering edge filter |
| 39 | `hotspot_threshold` | `git_analyzer/extract.py:299` | Metric | `50` (commits) | ❌ Hardcoded | Files with >50 commits = hotspot |

### 1.2 Suggested Parametrization Priority

**High priority (should be exposed to users):**
- `--find-renames` threshold (currently hardcoded `60%`)
- `ref` / `all_refs` (branch selection)
- `window_days` / `decay_half_life_days` (implement the logic, not just the param)
- `min_revisions` (implement filtering or remove)
- `hotspot_threshold` (hardcoded `50`)

**Medium priority:**
- `chunk_size` for git log streaming
- `min_component_cooccurrence` (implement or remove)

---

## 2. Git Options & Commands

### 2.1 Git Commands Used

| Command | File | Purpose |
|---------|------|---------|
| `git log --name-status --find-renames=60% --date-order -z` | `git.py:166-175` | Main history extraction |
| `git rev-list --count HEAD` | `git.py:420` | Commit counting |
| `git rev-parse HEAD` | `git.py:432` | Get HEAD OID |
| `git clone --mirror` | `mirror.py:26` | Repository mirroring |
| `git fetch --prune --tags` | `mirror.py:14-20` | Mirror update |
| `git ls-tree -r --name-only HEAD` | `sync.py:13` | HEAD file listing |
| `git remote get-url origin` | `git.py:449` | Remote URL detection |
| `git symbolic-ref refs/remotes/origin/HEAD` | `git.py:466` | Default branch detection |

### 2.2 Missing/Recommended Git Options

| Missing Option | Impact | Severity |
|----------------|--------|----------|
| `--no-merges` or merge handling | Merge commits inflate coupling (see issue #5) | 🔴 High |
| `--diff-filter` | No explicit delete filtering at git level | 🟡 Medium |
| `--numstat` | Line add/delete stats are tracked but **never populated** (always 0) | 🔴 High |
| `--first-parent` | For repos using merge-heavy workflows, avoids counting PR branch commits twice | 🟡 Medium |
| `--follow` | Not used for per-file history (rename tracking is manual) | 🟢 Low |
| `--find-copies` / `-C` | Copy detection not enabled | 🟢 Low |

---

## 3. Limits, Thresholds & Chunking

### 3.1 Processing Limits

| Limit | Value | Location | Purpose | Concern |
|-------|-------|----------|---------|---------|
| Stream chunk | 1MB | `git.py:128` | Git log read buffer | Fine for most cases |
| Max changeset | 50 files | `config.py:14` | Skip large commits | Applied **twice** (extract + changesets) |
| Max logical changeset | 100 files | `config.py:22` | For grouped modes | Only used in `by_author_time` and `by_ticket_id` |
| Min co-occurrence | 5 | `config.py:25` | Edge creation threshold | May be too high for small repos |
| Top-K edges/file | 50 | `config.py:36` | Edge pruning | Reasonable |
| Validation issue cap | 200 | `config.py:40` | In-memory sample cap | Fine |
| Hotspot threshold | 50 commits | `extract.py:299` | Hardcoded | Not parametrable |
| File list limit | 5000 | `routers/git.py:263` | API response | May truncate large repos |
| Edge export limit | 500 | `routers/git.py:78` | API response | May be insufficient |
| Graph edge limit | 200 | `api.py:82` | Coupling graph | May miss important edges |

### 3.2 Chunking & Batching

| Aspect | Current Behavior | Concern |
|--------|-----------------|---------|
| Parquet writing | Whole dataset in memory, single write | 🔴 OOM for repos with millions of changes |
| Edge computation | All pairs via `itertools.combinations` in memory | 🔴 O(n²) per changeset, no chunking |
| Entity lookups | Individual SQL per file per commit | 🟡 No batching, slow for large repos |
| Clustering | Full distance matrix in memory (DBSCAN/hierarchical) | 🔴 O(n²) memory for n files |
| Parquet reads | Full table reads (`to_pylist()`) | 🔴 No column pruning or filtering for edges |
| Dashboard summary | Full entity table scan | 🟡 Works but slow at scale |

---

## 4. Issues & Improvements

### 🔴 Critical (Accuracy / Data Integrity)

#### Issue #1: `min_revisions` declared but never used
- **File:** `config.py:13`, never referenced in `extract.py` or `edges.py`
- **Impact:** Files with very few commits still generate coupling edges, creating noise
- **Fix:** Filter files with < `min_revisions` commits before edge computation in `edges.py`

#### Issue #2: `min_component_cooccurrence` declared but never used
- **File:** `config.py:29`, not referenced in `edges.py:_build_component_edges()`
- **Impact:** Component edges are never filtered by minimum co-occurrence
- **Fix:** Apply filter in `_build_component_edges()`

#### Issue #3: `window_days` declared but never implemented
- **File:** `config.py:32`
- **Impact:** Users can set it but it does nothing; no time-windowed analysis
- **Fix:** Convert to `--since` equivalent or implement time-window filtering in extract

#### Issue #4: `decay_half_life_days` declared but never implemented
- **File:** `config.py:33`
- **Impact:** All commits weighted equally regardless of age — recent coupling is indistinguishable from ancient coupling
- **Fix:** Implement exponential decay weight: `weight = 2^(-age_days / half_life)` applied in `edges.py` changeset weight

#### Issue #5: Merge commits not handled properly
- **File:** `extract.py:105` — `is_merge` is computed but **never used for filtering or weighting**
- **Impact:** Merge commits inflate coupling scores. A merge of 100 files creates O(n²) = 4950 spurious pairs
- **Severity:** 🔴 Critical for repos with merge-heavy workflows
- **Fix:** Option A: Skip merges (`--no-merges`). Option B: `--first-parent`. Option C: Weight merges at 0 or very low.

#### Issue #6: `--numstat` not used — line stats always zero
- **File:** `extract.py:217-218` — `file_line_stats` initialized but never populated from git
- **Impact:** `total_lines_added` / `total_lines_deleted` always `0`. Churn rate always `0`. Risk score component "high churn" is non-functional.
- **Fix:** Add `--numstat` to git log command and parse line counts, or run a second pass

#### Issue #7: Jaccard denominator bug with weighted pair counts
- **File:** `edges.py:80-86`
- **Code:** `denom = src_count + dst_count - pair_count` — `pair_count` is a **float** (weighted) but `src_count` is an **int** (unweighted)
- **Impact:** Jaccard calculation mixes weighted and unweighted counts when changeset weights ≠ 1.0, producing mathematically incorrect values
- **Fix:** Keep weighted and unweighted pair counts separate; use unweighted for Jaccard, weighted for weighted Jaccard

#### Issue #8: Double changeset size filtering
- **File:** `extract.py:102` skips commits > `max_changeset_size`, then `changesets.py:40` skips again
- **Impact:** The `by_commit` path filters twice using the same threshold. The `by_author_time`/`by_ticket_id` paths use `max_logical_changeset_size` for the second filter (correct) but the first filter in extract.py already dropped individual large commits that could have been part of a valid logical changeset.
- **Fix:** Remove the filter in extract.py (let all commits through), apply only in changesets.py

#### Issue #9: `edges.py:50-51` — changeset size penalty applied AFTER max_changeset_size filter
- **File:** `edges.py:50-51`
- **Code:** `if len(file_ids) > self.config.max_changeset_size: weight *= 1.0 / math.log(...)` 
- **Impact:** This condition can never be true because changesets > max_changeset_size were already filtered out in `changesets.py:40`
- **Fix:** Dead code. Either remove or use a different threshold (e.g., `max_changeset_size / 2` for a soft penalty zone)

#### Issue #10: `get_file_coupling` only searches `src_entity_id` direction
- **File:** `api.py:57-73`
- **Impact:** If file A is stored as `dst_entity_id` in an edge, coupling query for A returns nothing. Only half the edges are returned.
- **Fix:** Use `UNION` query (like `get_file_impact` in `routers/git.py:134-153` already does correctly)

### 🟠 High (Performance / Scalability)

#### Issue #11: O(n²) pair computation in memory for all changesets
- **File:** `edges.py:54` — `for a, b in combinations(file_ids, 2)`
- **Impact:** A changeset with 50 files generates 1225 pairs. 100k commits × 20 files avg = massive memory usage. All pairs kept in `pair_counts` dict.
- **Fix:** Streaming aggregation or chunk-based processing. For very large repos, consider approximate algorithms or sampling.

#### Issue #12: Full Parquet loaded into memory for edge building
- **File:** `edges.py:28-29` — `commits.to_pylist()`, `changes.to_pylist()`
- **Impact:** For repos with 1M+ commits, this loads everything into Python dicts. Easily 10GB+ RAM.
- **Fix:** Use Arrow/DuckDB for aggregation, or process in chunks

#### Issue #13: `get_hotspots` loads ALL files + LEFT JOIN on ALL edges
- **File:** `api.py:281-296` — No LIMIT in the main query, filtering happens in Python
- **Impact:** For repos with 100k+ files, this is a full table scan with a heavy join
- **Fix:** Push sorting/limiting into SQL, use pre-computed risk scores

#### Issue #14: Clustering builds full NxN distance matrix
- **File:** `clustering/dbscan.py:45-46`, `clustering/hierarchical.py:49-50`
- **Impact:** For 50k files: 50k × 50k × 8 bytes = 20GB matrix. OOM guaranteed.
- **Fix:** Use sparse representations, limit to files with edges, or use approximate nearest neighbors

#### Issue #15: `update_head_status_bulk` — O(n) individual SQL queries
- **File:** `storage.py:291` — Loops through every file name with individual UPDATE + possible INSERT
- **Impact:** For repos with 100k files, this is 100k+ SQL round-trips
- **Fix:** Use temp table + bulk UPDATE with JOIN

#### Issue #16: Entity lookup per file per commit — no caching
- **File:** `extract.py:140-168` — `get_or_create_entity()` called per file per commit
- **Impact:** Same file seen in 500 commits = 500 SQL lookups (each with SELECT + possible INSERT)
- **Fix:** Add in-memory cache `dict[str, int]` for qualified_name → entity_id

#### Issue #17: Dashboard summary `get_authors` loads full Parquet + pandas
- **File:** `api.py:380-384` — Loads ALL commits into pandas just to count unique authors
- **Impact:** Unnecessary memory usage; author count could be pre-computed
- **Fix:** Pre-compute during extraction (already tracked in `file_authors`)

#### Issue #18: `get_file_activity` / `get_file_authors` / `get_file_commits` load full commits Parquet
- **File:** `routers/git.py:368-374, 428-434, 497-503`
- **Impact:** Each endpoint loads ALL commits into a dict just to look up metadata for a single file
- **Fix:** Use Arrow predicate pushdown or maintain commit data in SQLite

### 🟡 Medium (Correctness / Robustness)

#### Issue #19: `entities` unique index only on `qualified_name` — no kind discrimination
- **File:** `schema.py:46-47` — `CREATE UNIQUE INDEX ... ON entities(qualified_name)`
- **Impact:** If a file and a package have the same qualified_name, they'd conflict. The index doesn't include `kind`.
- **Fix:** `CREATE UNIQUE INDEX ... ON entities(qualified_name, kind)`

#### Issue #20: Risk score formula inconsistency
- **File:** `api.py:253-258` vs `api.py:315-318`
- **Impact:** Two different risk score formulas exist — `get_file_details` uses absolute commits/10, `get_hotspots` normalizes against max. Results differ for the same file.
- **Fix:** Unify to one formula, preferably the normalized one

#### Issue #21: `extract.py` transaction per change within a commit
- **File:** `extract.py:120` — `with self.storage.transaction():`
- **Impact:** Opens a transaction per change set in each commit. Should be one transaction per batch of commits.
- **Fix:** Batch commits into larger transactions (every 500-1000 commits)

#### Issue #22: Rename handling — end_commit_oid never populated
- **File:** `extract.py:244-247` — `end_commit_oid` always `NULL`
- **Impact:** Cannot reconstruct full rename chains; lineage query doesn't know when a path stopped being used
- **Fix:** Update `end_commit_oid` when a file is renamed away

#### Issue #23: `group_by_author_time` — time window is fixed, not sliding
- **File:** `changesets.py:77-90`
- **Impact:** If author makes commits at hours 0, 23, 46 with 24h window: commit at 0→group1, 23→group1 (within window), 46→group2. But if commits at 0, 25, 26: 0→group1, 25→group2 (new window), 26→group2. The window doesn't slide — it's anchored to first commit.
- **Severity:** This is actually reasonable behavior (session-based grouping), but should be documented

#### Issue #24: No file extension / binary filtering
- **File:** Nowhere in pipeline
- **Impact:** Binary files (images, compiled assets, lock files) are included in coupling analysis, creating noise
- **Fix:** Add configurable exclude patterns (e.g., `*.png`, `*.lock`, `package-lock.json`, `*.min.js`)

#### Issue #25: `get_coupling_graph` uses LIKE for path filtering
- **File:** `api.py:91-104`
- **Impact:** `LIKE 'src%'` matches `src/` but also `srcfoo/`. No trailing `/` enforcement.
- **Fix:** Use `root_path || '/%'` or add `/` to pattern

### 🟢 Low (Code Quality / Minor)

#### Issue #26: CLI defaults differ from config defaults
- **File:** `cli.py:61` — `--max-changeset-size` default `100` vs `config.py:14` default `50`
- **Impact:** Behavior differs depending on whether config or CLI is used
- **Fix:** Align defaults

#### Issue #27: `storage.py` — No connection pooling or reuse
- **File:** Throughout `api.py` and `routers/git.py`
- **Impact:** Every API call opens and closes a new SQLite connection
- **Fix:** Use connection pool or singleton per repo

#### Issue #28: `folder_details` returns hardcoded zeros for most fields
- **File:** `routers/git.py:576-589`
- **Impact:** Computes `lines_added`, `authors_count` but returns `0` for them
- **Fix:** Return the computed values

#### Issue #29: Schema lacks `ON DELETE CASCADE` for foreign keys
- **File:** `schema.py`
- **Impact:** Deleting an entity leaves orphaned edges, cluster members, etc.
- **Fix:** Add `ON DELETE CASCADE` or implement cleanup logic

#### Issue #30: `iter_log` stderr not captured/logged
- **File:** `git.py:200` — `stderr=subprocess.PIPE` but never read
- **Impact:** Git errors (auth failures, corrupt repos) silently lost
- **Fix:** Read and log stderr after process completes

---

## Summary

| Severity | Count | Key Themes |
|----------|-------|------------|
| 🔴 Critical | 10 | Dead params, merge handling, broken metrics, Jaccard bug |
| 🟠 High | 8 | Memory/OOM risks, O(n²) scaling, full-table loads |
| 🟡 Medium | 7 | Formula inconsistencies, missing filters, incomplete features |
| 🟢 Low | 5 | Default mismatches, code quality, missing cascades |

### Top 5 Priorities for Big Project Accuracy & Performance

1. **Implement merge commit handling** (#5) — biggest accuracy risk
2. **Fix one-directional coupling query** (#10) — half the data is invisible
3. **Add `--numstat` parsing** (#6) — churn/risk scores are non-functional
4. **Implement `min_revisions` filtering** (#1) — reduces noise significantly
5. **Add entity caching + batch processing** (#16, #12) — required for repos >50k commits
