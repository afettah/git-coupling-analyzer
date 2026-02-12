# Git Coupling Analyzer - Technical Settings & Performance Analysis

**Date**: 2026-02-07  
**Scope**: Backend code analysis for performance-critical parameters, limits, and configuration values

---

## 1. Core Configuration: `CouplingConfig` (git_analyzer/config.py)

### Commit-Level Filtering
| Parameter | Default | Type | Impact | Notes |
|-----------|---------|------|--------|-------|
| `min_revisions` | 5 | int | Filters commits with fewer than N revisions | Excludes rarely-changed files from coupling analysis |
| `max_changeset_size` | 50 | int | **CRITICAL** - Max files per commit changeset | Large changesets filtered out; heavy weighting impacts edge computation |

### Changeset Grouping & Timewindows
| Parameter | Default | Type | Impact | Notes |
|-----------|---------|------|--------|-------|
| `changeset_mode` | "by_commit" | str | Changeset grouping strategy | Options: `by_commit`, `by_author_time`, `by_ticket_id` |
| `author_time_window_hours` | 24 | int | **PERFORMANCE** - Time window for author-grouped changesets | Larger window = more commits grouped together = higher memory usage |
| `max_logical_changeset_size` | 100 | int | Max files in logical changeset | Acts as hard cap for grouped changes |

### Coupling Edge Computation
| Parameter | Default | Type | Impact | Notes |
|-----------|---------|------|--------|-------|
| `min_cooccurrence` | 5 | int | **CORRECTNESS** - Min co-occurrences to create edge | Lower = more edges, higher false positives |
| `topk_edges_per_file` | 50 | int | **PERFORMANCE** - Top-K edges retained per file | Limits memory footprint in graph analysis |
| `component_depth` | 2 | int | Hierarchical depth for component analysis | Affects clustering granularity |
| `min_component_cooccurrence` | 5 | int | Min co-occurrences at component level | Similar to `min_cooccurrence` but for components |

### Temporal Filtering & Decay
| Parameter | Default | Type | Impact | Notes |
|-----------|---------|------|--------|-------|
| `window_days` | None (nullable) | int | Time window for recent changes | When set, filters to last N days of history |
| `decay_half_life_days` | None (nullable) | int | Exponential decay for older commits | When set, weights recent commits more heavily |

### Validation & Error Handling
| Parameter | Default | Type | Impact | Notes |
|-----------|---------|------|--------|-------|
| `validation_mode` | SOFT | ValidationMode | **CORRECTNESS** - How to handle invalid data | Options: `strict` (abort), `soft` (skip), `permissive` (accept) |
| `max_validation_issues` | 200 | int | **MEMORY** - Cap on logged validation issues per run | Prevents unbounded memory growth during parsing errors |

---

## 2. Git Log Parsing: `_token_stream()` (git_analyzer/git.py)

### Buffer Management
| Parameter | Default | Type | Impact | Notes |
|-----------|---------|------|--------|-------|
| `chunk_size` | 1 << 20 (1MB) | int | **PERFORMANCE** - Git stdout read buffer size | Larger = fewer OS calls but higher memory; 1MB is standard for large repos |

### Git Log Configuration
| Parameter | Default | Type | Impact | Notes |
|-----------|---------|------|--------|-------|
| `--find-renames` | "60%" | str | **CORRECTNESS** - Rename detection threshold | 60% similarity to detect renames; lower = more false positives |
| `--date-order` | - | flag | Chronological order by commit date | Ensures predictable changeset grouping |
| `-z` (null-separator) | - | flag | **CRITICAL** - Null-byte delimiter for safe parsing | Required for handling special characters in paths/messages |

### Progress Reporting
| Parameter | Default | Type | Impact | Notes |
|-----------|---------|------|--------|-------|
| Progress callback interval | 100 commits | int | **MONITORING** - Progress report frequency | Reported every 100 commits in callback; logging every 1000 |
| Logging interval | 1000 commits | int | Info-level logging for extraction progress | Helps diagnose stuck processes |

---

## 3. Extraction & Statistics: `HistoryExtractor` (git_analyzer/extract.py)

### Data Aggregation
| Parameter | Default | Type | Impact | Notes |
|-----------|---------|------|--------|-------|
| `max_validation_issues` (sample cap) | 200 | int | **MEMORY** - Limits issue sample collection | Prevents OOM when parsing thousands of invalid paths |
| Issue samples | Up to 200 | list | Debug information retained | Only first 200 issues stored for logging |

### Path Validation Rules
| Rules | Impact | Notes |
|-------|--------|-------|
| Path length > 2 chars | Filters: "A", "B", single chars | Prevents status codes being treated as filenames |
| Must contain "/" or "." | Filters short unnamed files | Catches malformed git log output |
| Length > 3 + alpha-only check | Strict mode validation | Rejects short invalid paths like "IDE" or "SRC" |
| No `__LFCA_` prefix | Internal marker rejection | Prevents infinite loops on processing artifacts |
| No email addresses without "/" | Filters commit metadata appearing as paths | Catches malformed author_email in path position |

---

## 4. Edge Building & Metrics: `EdgeBuilder` (git_analyzer/edges.py)

### Pair Counting & Weight Calculation
| Parameter | Default | Type | Impact | Notes |
|-----------|---------|------|--------|-------|
| Changeset size weighting | Dynamic (log-based) | formula | **CORRECTNESS** - Discounts large changesets | `weight *= 1.0 / log(1 + file_count)` for changesets > max_changeset_size |
| Pair filtering | `>= min_cooccurrence` | int | **PERFORMANCE** - Filters weak edges before metric computation | Critical for reducing graph size |

### Weight Metrics (Stored in `git_edges` table)
| Metric | Calculation | Use Case | Impact |
|--------|-------------|----------|--------|
| `pair_count` | Sum of weights | Total co-occurrence count | Base metric for filtering |
| `jaccard` | Unweighted similarity | Canonical coupling metric | Default for rankings |
| `jaccard_weighted` | Weighted by changeset size | Temporal importance | Better captures recent changes |
| `p_dst_given_src` | P(B changed \| A changed) | Directional impact | Risk assessment |
| `p_src_given_dst` | P(A changed \| B changed) | Reverse impact | Complementary risk view |

---

## 5. Clustering Algorithms Configuration

### DBSCAN (clustering/dbscan.py)
| Parameter | Default | Type | Impact | Notes |
|-----------|---------|------|--------|-------|
| `eps` | 0.5 | float | **CRITICAL** - Max distance (1 - similarity) for neighborhood | Higher eps = looser clusters; 0.5 = 50% dissimilarity threshold |
| `min_samples` | 2 | int | **CRITICAL** - Min samples in neighborhood | Files with < 2 neighbors marked as noise |
| `weight_column` | "jaccard" | str | Which metric to use for distance calculation | Can also use jaccard_weighted, p_dst_given_src, etc. |
| Distance matrix construction | O(n²) | space | **PERFORMANCE** - Builds full NxN distance matrix | Memory-intensive for projects with 1000+ files |

### Other Clustering Algorithms
- **Louvain**: Community detection via modularity optimization
- **Hierarchical**: Agglomerative clustering with dendrogram analysis
- **Label Propagation**: Semi-supervised clustering using seed labels

---

## 6. API Query Limits & Defaults (Routers)

### graph.py - Entity & Relationship Queries
| Endpoint | Default Limit | Max Recommended | Use Case |
|----------|---------------|-----------------|----------|
| `/entities` | limit=50, offset=0 | 1000 | Entity search with pagination |
| `/entities/{entity_id}` (outgoing) | LIMIT 100 | - | Related files (top-coupled) |
| `/entities/{entity_id}` (incoming) | LIMIT 100 | - | Files that depend on this entity |
| `/neighbors/{entity_id}` | limit=100, max_depth=1 | - | Direct neighbors only |
| `/paths` | max_length=5 | - | **PERFORMANCE** - Longest path in BFS |
| Graph statistics | - | - | AVG/MAX degree, density |

### intelligence.py - Risk & Intelligence Queries
| Query | Default Limit | Impact | Notes |
|-------|---------------|--------|-------|
| Knowledge graph edges | LIMIT 10 | **PERFORMANCE** - Top 10 high-risk relations | Prevents massive frontend payloads |
| Relationship count | LIMIT ? (parameterized) | User-defined | Pagination support for result sets |

### risk.py - Risk Scoring
| Calculation | Thresholds | Impact | Notes |
|-------------|-----------|--------|-------|
| High risk | commits >= 70% of max | File change frequency bucketing | Distribution: 0-20, 20-40, 40-60, 60-80, 80-100% |
| Medium risk | 40-70% threshold | Risk tiers | Coupling strength also factored |
| Low risk | < 40% threshold | - | Default for new/rarely-changed files |

---

## 7. Database Query Patterns & Performance Considerations

### SQLite Performance Tuning
| Setting | Current | Recommended | Impact |
|---------|---------|-------------|--------|
| Connection pooling | Single Storage instance | Consider connection pool | Concurrent API requests |
| Query pagination | LIMIT + OFFSET | Cursor-based for large tables | Avoids full table scans |
| Index strategy | Auto on `entity_id` | Add composite indexes | FK joins are costly at scale |
| JSON extraction | `json_extract()` in WHERE | Index JSON columns | Metadata queries are slow |

### Table Sizes (Before Optimization)
| Table | Row Count (1000-file repo) | Impact | Notes |
|-------|---------------------------|--------|-------|
| `entities` | ~1000-5000 | Fast lookups | File + code entity records |
| `git_edges` | ~5000-50000 | Slower filtering | Quadratic with coupling density |
| `relationships` | ~10000-100000 | Slowest | Includes all analyzer results |
| `analysis_runs` | ~100-1000 | Fast | Metadata-only |

---

## 8. Memory & Processing Patterns

### Extract Phase Memory Usage
| Component | Estimated Size (1000-file, 10K-commit repo) | Factor |
|-----------|------|--------|
| Commit objects in memory | ~5-10 MB | Parquet streaming |
| Changes list | ~10-20 MB | All file changes per commit |
| File commit counts dict | ~0.5 MB | Counter[int] |
| File authors dict | ~1-2 MB | dict[int, set[str]] |
| Validation issue samples | ~0.2-0.5 MB | Cap at 200 issues |
| **Total extracted data** | ~17-32 MB | Moderate - allows streaming |

### Edge Building Memory Usage
| Component | Estimated Size (1000-file, 10K-commit repo) | Factor |
|-----------|------|--------|
| Pair counts dict | ~5-20 MB | defaultdict[(int,int), float] |
| File counts Counter | ~0.5 MB | Counter[int] |
| File weights dict | ~1 MB | defaultdict[int, float] |
| Filtered pairs | ~2-10 MB | After min_cooccurrence filter |
| **Total for edge building** | ~9-31 MB | Moderate - filtering is aggressive |

### Query Phase Memory Usage
| Operation | Estimated Size (1000-file repo) | Impact |
|-----------|------|--------|
| Distance matrix (DBSCAN) | 4 MB (1000²) | **CRITICAL** - O(n²) space |
| Cluster assignment | ~0.1 MB | List[int] |
| Entity/edge result sets | ~1-5 MB | Depends on query |

---

## 9. Known Bottlenecks & Critical Parameters

### Performance Bottlenecks
1. **DBSCAN Distance Matrix**: O(n²) memory for n files
   - Mitigation: Limit to top-K edges per file (`topk_edges_per_file=50`)
   - Alternative: Use Louvain for large graphs

2. **Large Changesets**: Heavy weighting penalties
   - Current: `weight *= 1.0 / log(1 + changeset_size)`
   - Impact: Large commits (>50 files) effectively ignored
   - Tune: Adjust `max_changeset_size` or `max_logical_changeset_size`

3. **JSON Extraction in SQLite**: No native indexing
   - Impact: `json_extract()` in WHERE clauses slow
   - Mitigation: Denormalize risk scores to dedicated columns

4. **Progress Callback Interval**: Every 100 commits
   - Impact: Minimal (callback is user-defined)
   - Trade-off: More frequent = less batching efficiency

### Correctness Concerns
1. **Rename Detection (60% threshold)**
   - False negatives: Similar-named files not detected as renames
   - False positives: Rare (60% is conservative)
   - Tuning: Adjust `--find-renames` in `iter_log()`

2. **Path Validation**: Multi-layered filtering
   - Risk: Valid but unusual paths rejected
   - Mitigation: `permissive` validation mode for exploratory analysis
   - Best practice: Use `soft` (default) in production

3. **Validation Issue Capping**
   - Risk: Later issues not logged (only first 200)
   - Impact: May hide patterns in repositories with systematic issues
   - Mitigation: Logs indicate total issue count even if sample capped

---

## 10. Environment Configuration

### Data Directory Structure
```
$CODE_INTEL_DATA_DIR/
├── repos/
│   └── {repo_id}/
│       ├── mirror.git              (bare clone for analysis)
│       ├── code-intel.sqlite       (main analysis DB)
│       ├── parquet/
│       │   ├── commits.parquet     (extraction output)
│       │   └── changes.parquet     (per-file changes)
│       ├── snapshots/              (state snapshots)
│       └── logs/                   (analysis logs)
```

### Environment Variables
| Variable | Default | Purpose |
|----------|---------|---------|
| `CODE_INTEL_DATA_DIR` | "data" | Root directory for all repositories |
| `CODE_INTEL_LOG_LEVEL` | (Python default) | Logging verbosity |

---

## 11. Parametrization Recommendations for New Projects

### Small Projects (<100 files, <1K commits)
```python
CouplingConfig(
    min_revisions=2,              # Lower threshold
    max_changeset_size=100,       # Raise limit
    min_cooccurrence=2,           # More edges
    author_time_window_hours=12,  # Tighter grouping
    topk_edges_per_file=100,      # Keep more edges
)
```

### Medium Projects (100-1000 files, 1K-10K commits)
```python
CouplingConfig(
    min_revisions=5,              # Default is good
    max_changeset_size=50,        # Default
    min_cooccurrence=5,           # Default
    author_time_window_hours=24,  # Default (1 day)
    topk_edges_per_file=50,       # Default
)
```

### Large Projects (1000+ files, 10K+ commits)
```python
CouplingConfig(
    min_revisions=10,             # Higher threshold
    max_changeset_size=30,        # Stricter filtering
    min_cooccurrence=10,          # Fewer, stronger edges
    author_time_window_hours=4,   # Shorter windows
    topk_edges_per_file=20,       # Aggressive reduction
)
```

### API Query Tuning
```python
# For exploratory UI
limit=50, min_weight=0.0, offset=0

# For production dashboards
limit=100, min_weight=0.1, offset=0

# For risk analysis
limit=200, min_weight=0.05, max_depth=2

# For graph analytics (large repos)
limit=10, max_length=3, min_weight=0.2
```

---

## 12. Summary Table: All Tunable Parameters

| Component | Parameter | Default | Range | Sensitivity | Impact Level |
|-----------|-----------|---------|-------|-------------|-------------|
| Extraction | `min_revisions` | 5 | 1-100 | HIGH | CORRECTNESS |
| Extraction | `max_changeset_size` | 50 | 5-500 | MEDIUM | PERFORMANCE |
| Extraction | `chunk_size` | 1MB | 256KB-10MB | LOW | PERFORMANCE |
| Grouping | `author_time_window_hours` | 24 | 1-168 | HIGH | CORRECTNESS |
| Grouping | `max_logical_changeset_size` | 100 | 10-1000 | MEDIUM | PERFORMANCE |
| Filtering | `min_cooccurrence` | 5 | 1-50 | HIGH | CORRECTNESS |
| Filtering | `topk_edges_per_file` | 50 | 5-500 | MEDIUM | MEMORY |
| Component | `component_depth` | 2 | 1-5 | MEDIUM | CORRECTNESS |
| Component | `min_component_cooccurrence` | 5 | 1-50 | MEDIUM | CORRECTNESS |
| Temporal | `window_days` | None | 1-365 | HIGH | CORRECTNESS |
| Temporal | `decay_half_life_days` | None | 1-365 | MEDIUM | CORRECTNESS |
| Clustering | `eps` (DBSCAN) | 0.5 | 0.1-0.9 | HIGH | CORRECTNESS |
| Clustering | `min_samples` (DBSCAN) | 2 | 1-10 | MEDIUM | CORRECTNESS |
| Validation | `validation_mode` | SOFT | STRICT/SOFT/PERMISSIVE | - | CORRECTNESS |
| Validation | `max_validation_issues` | 200 | 10-10000 | LOW | MEMORY |
| API | `limit` (queries) | 50-200 | 1-1000 | LOW | PERFORMANCE |
| Git | `--find-renames` | 60% | 40%-100% | MEDIUM | CORRECTNESS |

---

## 13. Testing & Validation Checklist

- [ ] Run extraction on test repo with different `validation_mode` values
- [ ] Benchmark edge building with varying `min_cooccurrence` thresholds
- [ ] Test DBSCAN with different `eps` and `min_samples` combinations
- [ ] Validate API response times with different `limit` values on production data
- [ ] Profile memory usage for repos at 100, 1000, 10000+ file scale
- [ ] Test rename detection accuracy with `--find-renames` thresholds
- [ ] Verify correctness of risk scoring with edge case distributions
- [ ] Check database indexes for slow JSON extraction queries
- [ ] Monitor callback interval impact on extraction speed
- [ ] Test temporal filtering with `window_days` on long-history repos
