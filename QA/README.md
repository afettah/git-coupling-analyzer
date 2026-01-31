# QA Testing Framework

Quality Assurance testing framework for LFCA (Logical File Coupling Analyzer).

## Overview

This framework provides:
1. **Ground Truth Collection** - Scripts to extract baseline data from git
2. **API Testing** - Automated API endpoint testing and data collection
3. **Validation** - Compare API results against ground truth
4. **Detailed Statistics** - Individual file and cluster analysis

## Quick Start

```bash
# 1. Collect ground truth from a git repository
cd /path/to/target/repo
bash QA/scripts/run_all_qa.sh
# Output: QA/output/{repo}/

# 2. Start LFCA API server
python -m uvicorn lfca.api:app --reload

# 3. Run API tests
python QA/scripts/api_test_collector.py --repo {repo_id}

# 4. Validate results
python QA/scripts/validate_api_results.py --repo {repo_id}

# 5. Collect detailed statistics
python QA/scripts/collect_detailed_stats.py --repo {repo_id}
```

## Directory Structure

```
QA/
├── README.md                  # This file
├── scripts/                   # Testing scripts
│   ├── run_all_qa.sh         # Run all ground truth collection
│   ├── api_test_collector.py  # Collect API responses
│   ├── validate_api_results.py # Validate against ground truth
│   ├── collect_detailed_stats.py # Detailed file/cluster stats
│   └── *.sh                   # Individual ground truth scripts
└── output/
    └── {repo}/                # Per-repository output
        ├── QA_INDEX.md        # Index of all QA data
        ├── FINDINGS_REPORT.md # Ground truth findings
        ├── API_QA_FINDINGS.md # API testing findings
        ├── *.json/*.csv       # Ground truth data files
        ├── api_tests/         # API test results
        └── detailed_stats/    # Detailed statistics
```

## Scripts

### Ground Truth Collection (Bash)

| Script | Purpose |
|--------|---------|
| `run_all_qa.sh` | Run all collection scripts |
| `gather_repo_stats.sh` | Basic repository statistics |
| `file_change_frequency.sh` | File commit counts |
| `cochange_analysis.sh` | Co-change pair analysis |
| `author_analysis.sh` | Contributor analysis |
| `module_analysis.sh` | Folder/module statistics |
| `bulk_commits.sh` | Large commit detection |
| `rename_detection.sh` | File rename tracking |
| `deleted_files.sh` | Deleted file analysis |
| `coupling_ground_truth.sh` | Known coupling pairs |
| `test_impl_coupling.sh` | Test-implementation pairs |
| `hotspot_analysis.sh` | Code churn analysis |

### API Testing (Python)

| Script | Purpose |
|--------|---------|
| `api_test_collector.py` | Collect all API endpoint responses |
| `validate_api_results.py` | Validate API against ground truth |
| `collect_detailed_stats.py` | Detailed file/cluster statistics |
| `collect_qa_data.py` | Python-based ground truth collection |

## API Endpoints Tested

| Endpoint | Method | Status |
|----------|--------|--------|
| `/repos` | GET | ✅ Tested |
| `/repos/{id}/files` | GET | ✅ Tested |
| `/repos/{id}/files/tree` | GET | ✅ Tested |
| `/repos/{id}/folders` | GET | ✅ Tested |
| `/repos/{id}/files/{path}/history` | GET | ✅ Tested |
| `/repos/{id}/coupling` | GET | ✅ Tested |
| `/repos/{id}/coupling/graph` | GET | ✅ Tested |
| `/repos/{id}/coupling/evidence` | GET | ✅ Tested |
| `/repos/{id}/coupling/components` | GET | ✅ Tested |
| `/repos/{id}/clustering/algorithms` | GET | ✅ Tested |
| `/repos/{id}/clustering/run` | POST | ✅ Tested |
| `/repos/{id}/analysis/status` | GET | ✅ Tested |

## Validation Checks

### File Validation
- File count comparison
- Hotspot ranking overlap
- Commit count accuracy

### Coupling Validation
- High-coupling pair detection
- Jaccard score accuracy
- Cross-stack coupling detection

### Clustering Validation
- Cluster count reasonableness
- Singleton detection
- Algorithm availability

### Evidence Validation
- File ID resolution
- Common commit detection
- Commit detail retrieval

## Known Issues

| Issue | Severity | Status |
|-------|----------|--------|
| Evidence API set bug | High | ✅ Fixed |
| Spectral clustering error | Medium | ❌ Open |
| Component coupling empty | Medium | ❌ Open |
| Sparse clustering (filtering) | Low | Expected |

## Usage Examples

### Validate a specific repository

```bash
# Collect ground truth
cd /path/to/repo
bash /path/to/lfca/QA/scripts/run_all_qa.sh

# Run LFCA analysis
lfca analyze /path/to/repo --name myrepo

# Test API
python QA/scripts/api_test_collector.py --repo myrepo
python QA/scripts/validate_api_results.py --repo myrepo
```

### Check coupling accuracy

```python
import json

# Load ground truth
with open('QA/output/myrepo/coupling_ground_truth.json') as f:
    gt = json.load(f)

# Load API results
with open('QA/output/myrepo/api_tests/coupling_data.json') as f:
    api = json.load(f)

# Compare specific pairs...
```

### Analyze clustering results

```python
import json

with open('QA/output/myrepo/detailed_stats/clustering_details.json') as f:
    data = json.load(f)

for name, run in data['runs'].items():
    print(f"{name}: {run['cluster_count']} clusters, "
          f"{run['singleton_count']} singletons")
```

## Reference Project

The OpenHands repository is used as the primary reference project for QA testing:
- GitHub: https://github.com/All-Hands-AI/OpenHands
- 5,971 commits, 2,765 files
- Rich rename history (OpenDevin → OpenHands)
- Multi-language (Python + TypeScript)
- Strong test-implementation coupling patterns

## Output Files

See [QA_INDEX.md](output/openhands/QA_INDEX.md) for complete file listing.
