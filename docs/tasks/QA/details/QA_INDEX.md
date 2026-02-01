# OpenHands QA Data Index

**Repository:** OpenHands  
**Generated:** 2026-01-31  
**Purpose:** Ground truth data and API test results for LFCA validation

---

## Quick Links

- [Main Findings Report](FINDINGS_REPORT.md) - Comprehensive ground truth analysis
- [API QA Findings](API_QA_FINDINGS.md) - API testing results and issues found
- [Detailed QA Report](DETAILED_QA_REPORT.md) - Bug documentation with reproduction steps
- [Validation Report](VALIDATION_REPORT.md) - Automated validation results
- [API Test Summary](API_TEST_SUMMARY.md) - Human-readable API test summary

---

## 1. Ground Truth Data (from Git)

Data files are located in: `QA/output/openhands/`

### Repository Statistics

| File | Description | Use Case |
|------|-------------|----------|
| basic_stats.json | Commit counts, file counts, dates | Verify repository-level stats |
| quick_stats.json | Quick summary stats | Dashboard validation |
| repo_stats.json | Detailed repo statistics | Deep validation |

### File Analysis

| File | Description | Use Case |
|------|-------------|----------|
| file_commits.json | Top 100 files by commit count | Hotspot validation |
| file_commits.csv | All file commit counts | Ranking validation |
| file_churn.csv | Lines changed per file | Churn analysis |
| deleted_files.json | Deleted file tracking | History validation |

### Coupling Ground Truth

| File | Description | Use Case |
|------|-------------|----------|
| coupling_ground_truth.json | Known high-coupling pairs | Coupling API validation |
| coupling_ground_truth.csv | CSV format | Import for comparison |
| cochange_pairs.json | Top co-change pairs | Edge validation |
| cochange_pairs.csv | CSV format | Import for analysis |
| test_impl_coupling.json | Test-implementation pairs | Pattern validation |

### Author & Module Analysis

| File | Description | Use Case |
|------|-------------|----------|
| author_analysis.json | Contributor statistics | Author-based filtering |
| author_stats.csv | Author CSV | Import for analysis |
| module_analysis.json | Folder-level stats | Component validation |
| folder_stats.csv | Folder CSV | Import for analysis |

### Special Cases

| File | Description | Use Case |
|------|-------------|----------|
| bulk_commits.json | Commits with >50 files | Bulk commit filtering |
| renames.json | File rename tracking | History tracking |
| hotspot_analysis.json | Code churn hotspots | Quality analysis |

---

## 2. API Test Results

API test data files are located in: `QA/output/openhands/api_tests/`

### Full API Data

| File | Description |
|------|-------------|
| full_api_results.json | Complete API responses |

### Individual Endpoints

| File | Endpoint |
|------|----------|
| repository_info.json | GET /repos |
| file_info.json | GET /repos/{id}/files |
| coupling_data.json | GET /repos/{id}/coupling |
| coupling_evidence.json | GET /repos/{id}/coupling/evidence |
| file_history.json | GET /repos/{id}/files/{path}/history |
| component_coupling.json | GET /repos/{id}/coupling/components |
| clustering.json | POST /repos/{id}/clustering/run |
| analysis_status.json | GET /repos/{id}/analysis/status |

### Validation

| File | Description |
|------|-------------|
| VALIDATION_REPORT.json | Automated validation results (JSON) |

---

## 3. Detailed Statistics

Detailed statistics files are located in: `QA/output/openhands/detailed_stats/`

| File | Description |
|------|-------------|
| file_details.json | Per-file coupling info |
| file_details.csv | CSV for analysis |
| clustering_details.json | Clustering run results |
| folder_statistics.json | Folder-level stats |
| coupling_matrix.json | Top files coupling matrix |

---

## 4. Key Validation Test Cases

### Test Case 1: Lock File Coupling
- **Files:** `frontend/package.json` ↔ `frontend/package-lock.json`
- **Expected:** Jaccard > 0.9
- **Ground Truth:** ~498 co-changes
- **API Result:** Jaccard = 0.9365 ✅

### Test Case 2: i18n File Coupling
- **Files:** `frontend/src/i18n/translation.json` ↔ `frontend/src/i18n/declaration.ts`
- **Expected:** Jaccard > 0.8
- **Ground Truth:** 138 co-changes
- **API Result:** Jaccard = 0.6667 ⚠️ (lower due to filtering)

### Test Case 3: Docker Config Coupling
- **Files:** `containers/dev/compose.yml` ↔ `docker-compose.yml`
- **Expected:** Jaccard > 0.7
- **Ground Truth:** 47 co-changes
- **API Result:** Jaccard = 0.6935 ✅

### Test Case 4: Cross-Stack Coupling
- **Files:** `pyproject.toml` ↔ `frontend/package.json`
- **Expected:** Detected as coupled
- **API Result:** Jaccard = 0.7703 ✅

### Test Case 5: Bulk Commit Filtering
- **Scenario:** Commits with >50 files excluded
- **Expected:** Reduced coupling for bulk-only pairs
- **API Result:** poetry.lock shows 16 commits (vs 748 raw) ✅

---

## 5. Known Issues (Updated 2026-01-31)

| Issue | Severity | Status | Details |
|-------|----------|--------|---------|
| **Data Corruption** | 🔴 Critical | ❌ Open | Git status codes (A,M,D) and emails stored as file paths |
| **File Tree Empty** | 🔴 High | ❌ Open | Returns `{children:[]}` - format mismatch |
| **Search Prefix-Only** | 🟡 Medium | ❌ Open | Uses `q%` not `%q%` |
| **Pagination Missing** | 🟡 Medium | ❌ Open | `offset` param ignored |
| Component coupling empty | 🟡 Medium | ❌ Open | Query doesn't match DB format |
| Evidence API set bug | 🟢 Low | ✅ Fixed | Set comprehension fixed |
| Spectral clustering fails | 🟡 Medium | ❌ Open | Internal error |
| Sparse clustering (99% singletons) | 🟢 Info | Expected | Due to min_cooccurrence=5 |

### New Report Files

| File | Description |
|------|-------------|
| [DETAILED_QA_REPORT.md](DETAILED_QA_REPORT.md) | Comprehensive bug report with reproduction steps |
| [API_QA_FINDINGS.md](API_QA_FINDINGS.md) | Updated with critical bug documentation |

---

## 6. Scripts

| Script | Purpose |
|--------|---------|
| `QA/scripts/api_test_collector.py` | Collect API responses |
| `QA/scripts/validate_api_results.py` | Validate against ground truth |
| `QA/scripts/collect_detailed_stats.py` | Collect detailed file/cluster stats |

### Usage

```bash
# Collect API test data
python QA/scripts/api_test_collector.py --repo openhands

# Validate results
python QA/scripts/validate_api_results.py --repo openhands

# Collect detailed statistics
python QA/scripts/collect_detailed_stats.py --repo openhands
```

---

## 7. Analysis Configuration

The LFCA analysis was run with:

```json
{
  "min_revisions": 5,
  "max_changeset_size": 50,
  "min_cooccurrence": 5,
  "changeset_mode": "by_commit"
}
```

**Implications:**
- Files with <5 commits excluded (2,765 → 1,462 files)
- Commits with >50 files excluded (5,971 → 5,844 commits)
- Only pairs with ≥5 co-occurrences have edges (410 edges)
- Results in sparse coupling graph (61 files with edges)

---

*This index is auto-generated. See individual files for detailed data.*
