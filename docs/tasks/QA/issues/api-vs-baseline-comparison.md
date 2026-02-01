# API vs Baseline Data Comparison Report

**Date:** 2026-02-01  
**Baseline Collection:** 2026-01-31  
**Repository:** openhands

## Executive Summary

Significant discrepancies found between API results and baseline data. Key issues include:
- **Commit count mismatch**: API reports 5,871 commits vs baseline 5,971 (100 fewer)
- **File count mismatch**: API reports 1,462 total files vs baseline 6,276 unique files (77% fewer)
- **Current files mismatch**: API reports 451 current files vs baseline 2,765 (84% fewer)
- **Coupling data incomplete**: Most high-value coupling pairs from baseline are missing in API

---

## 1. Basic Stats Comparison

| Metric | Baseline | API | Difference | Severity |
|--------|----------|-----|------------|----------|
| Total Commits | 5,971 | 5,871 | -100 (-1.7%) | **MEDIUM** |
| Current Files | 2,765 | 451 | -2,314 (-84%) | **CRITICAL** |
| Total Unique Files | 6,276 | 1,462 | -4,814 (-77%) | **CRITICAL** |
| Edge Count | N/A | 410 | - | - |
| Authors | 459 | Not exposed via API | - | INFO |

### Root Cause Analysis

**Commit Count (-100):**
- API uses `min_revisions=5` filter during analysis
- Commits that only touch files with <5 revisions are excluded
- This is expected behavior based on analysis config

**File Count (-84%):**
- API only indexes files that meet the `min_revisions` threshold
- Baseline counted ALL files ever touched in git history
- Files with ≤4 commits are not indexed by LFCA
- This significantly underrepresents the repository

---

## 2. File Commits (Hotspot) Comparison

### Top 10 Files by Commits

| Rank | Baseline File | Baseline Commits | API File | API Commits |
|------|---------------|------------------|----------|-------------|
| 1 | poetry.lock | 748 | pyproject.toml | 71 |
| 2 | frontend/package-lock.json | 525 | frontend/package-lock.json | 61 |
| 3 | frontend/package.json | 522 | frontend/package.json | 61 |
| 4 | pyproject.toml | 446 | containers/dev/compose.yml | 50 |
| 5 | README.md | 251 | docker-compose.yml | 45 |
| 6 | frontend/src/i18n/translation.json | 244 | README.md | 20 |
| 7 | openhands/llm/llm.py | 159 | openhands/runtime/impl/kubernetes/README.md | 18 |
| 8 | frontend/src/i18n/declaration.ts | 150 | poetry.lock | 16 |
| 9 | openhands/controller/agent_controller.py | 138 | frontend/src/i18n/translation.json | 9 |
| 10 | openhands/runtime/base.py | 120 | openhands/server/routes/manage_conversations.py | 8 |

### Discrepancy Analysis

| File | Baseline Commits | API Commits | Difference |
|------|------------------|-------------|------------|
| poetry.lock | 748 | 16 | **-732 (-98%)** |
| frontend/package-lock.json | 525 | 61 | **-464 (-88%)** |
| pyproject.toml | 446 | 71 | **-375 (-84%)** |
| openhands/llm/llm.py | 159 | 4 | **-155 (-97%)** |
| openhands/controller/agent_controller.py | 138 | 3 | **-135 (-98%)** |

**Severity:** **CRITICAL**

### Root Cause

The API's commit counts only reflect commits within the current analysis window (transactions that passed all filters). The analysis config uses:
- `max_changeset_size: 50` - Large commits are excluded
- `max_logical_changeset_size: 100` - Further filtering
- Files touching only excluded commits show reduced counts

This is **misleading** for hotspot analysis - users expect actual commit counts, not filtered counts.

---

## 3. Coupling Ground Truth Comparison

### Baseline High-Coupling Pairs (Jaccard = 1.0)

| File A | File B | Baseline Jaccard | API Result |
|--------|--------|------------------|------------|
| enterprise/integrations/jira/jira_view.py | enterprise/tests/.../test_jira_view.py | 1.0 | **FILE NOT FOUND** |
| enterprise/storage/api_key_store.py | enterprise/tests/.../test_api_key_store.py | 1.0 | **FILE NOT FOUND** |
| enterprise/server/routes/orgs.py | enterprise/storage/org_service.py | 1.0 | **FILE NOT FOUND** |

**Severity:** **CRITICAL**

### Root Cause

Enterprise files are completely missing from API results because:
1. Files with <5 commits are not indexed
2. Enterprise module is relatively new with fewer commits per file
3. No coupling relationships can be detected for non-indexed files

---

## 4. Test-Implementation Coupling

### Expected High-Coupling Test Pairs

| Test File | Implementation File | Baseline Jaccard | API Detection |
|-----------|---------------------|------------------|---------------|
| tests/unit/test_agent_controller.py | openhands/controller/agent_controller.py | Expected high | **NOT DETECTED** |
| tests/unit/test_config.py | openhands/core/config/*.py | Expected high | **NOT DETECTED** |

The API returns empty coupling results `[]` for core files like:
- `openhands/llm/llm.py`
- `openhands/controller/agent_controller.py`

**Severity:** **HIGH**

### Root Cause

Even when files exist in the API's file list, coupling detection fails because:
1. The `topk_edges_per_file: 50` limit may exclude weak relationships
2. The `min_cooccurrence: 5` threshold requires 5+ co-changes
3. The `max_changeset_size: 50` filter removes large refactoring commits where test/impl co-occur

---

## 5. Co-change Pairs Comparison

### Baseline Top Co-change Pairs

| Pair | Baseline Co-changes | API Detection |
|------|---------------------|---------------|
| frontend/package-lock.json ↔ frontend/package.json | 498 | ✅ Detected (59 co-changes, jaccard=0.94) |
| poetry.lock ↔ pyproject.toml | 312 | ⚠️ Detected as "M" ↔ pyproject.toml (anomalous) |
| frontend/src/i18n/declaration.ts ↔ translation.json | 138 | ❌ NOT DETECTED |
| containers/dev/compose.yml ↔ docker-compose.yml | 47 | ✅ Detected (43 co-changes, jaccard=0.84) |

**Severity:** **HIGH**

### Anomaly: Synthetic Metadata Files

The API contains entries with paths "A", "D", "M", and "__LFCA_COMMIT__":

```
file_id | path_latest | total_commits | exists_at_head
3       | M           | 3272          | 0
2       | A           | 773           | 0
1       | D           | 249           | 0
46      | __LFCA_COMMIT__ | 95        | 0
```

These appear to be metadata tracking (possibly Added/Deleted/Modified flags or commit markers) that have been erroneously included in the file index and are polluting coupling results.

**Severity:** **CRITICAL** - These synthetic entries dominate the top edges table.

---

## 6. Hotspot Analysis Comparison

### Top 20 by Churn (Baseline)

| File | Commits | Churn | API Has File |
|------|---------|-------|--------------|
| frontend/package-lock.json | 525 | 263,137 | ✅ Yes |
| poetry.lock | 748 | 127,832 | ✅ Yes |
| docs/package-lock.json | 39 | 58,684 | ❌ No (deleted) |
| frontend/src/i18n/translation.json | 244 | 51,210 | ✅ Yes |
| openhands/llm/llm.py | 158 | 3,223 | ✅ Yes |

**Note:** The API does not expose churn (insertions + deletions) data. Only commit counts are available via `/files` endpoint.

---

## 7. Summary of Issues

### Critical Issues

| Issue | Impact | Recommendation |
|-------|--------|----------------|
| **84% of current files missing** | Users cannot analyze most of their codebase | Lower `min_revisions` threshold or make it configurable per-query |
| **Synthetic metadata files (A, D, M) in index** | Pollutes coupling results | Filter these during extraction or exclude from API responses |
| **Commit counts vastly underreported** | Hotspot analysis unreliable | Expose raw commit counts separately from filtered counts |
| **Enterprise module completely missing** | Cannot analyze enterprise code | Support partial analysis for newer code areas |

### High Issues

| Issue | Impact | Recommendation |
|-------|--------|----------------|
| **Test-impl coupling not detected** | Primary use case fails | Review filtering thresholds; consider test file special handling |
| **Large refactoring commits excluded** | Miss important coupling signals | Make `max_changeset_size` configurable or use adaptive threshold |

### Medium Issues

| Issue | Impact | Recommendation |
|-------|--------|----------------|
| **100 commits missing** | Minor data incompleteness | Expected due to filtering; document behavior |
| **No churn data in API** | Cannot identify volatility hotspots | Add insertions/deletions to file details endpoint |

---

## 8. Recommendations

### Immediate (Data Accuracy)

1. **Filter synthetic entries** - Exclude paths matching `/^[ADM]$/` or `__LFCA_` from API responses
2. **Add raw commit counts** - Store unfiltered commit counts alongside filtered transaction counts
3. **Lower default min_revisions** - Consider `min_revisions=2` for broader coverage

### Short-term (Feature Enhancement)

1. **Expose analysis config** - Include filter thresholds in `/analysis/status` so users understand data scope
2. **Add warning for low coverage** - Alert when <50% of HEAD files are indexed
3. **Support threshold override** - Allow per-query `min_revisions` for exploratory analysis

### Long-term (Architecture)

1. **Separate extraction from analysis** - Store all commits/files, apply thresholds at query time
2. **Add incremental updates** - Support re-analysis without full re-extraction when thresholds change
