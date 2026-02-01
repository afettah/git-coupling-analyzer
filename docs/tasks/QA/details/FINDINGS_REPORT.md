# OpenHands Repository Analysis - QA Ground Truth Report

> **Generated**: 2026-01-31  
> **Repository**: OpenHands (https://github.com/OpenHands/OpenHands)  
> **Purpose**: Ground truth data for LFCA (Logical File Coupling Analyzer) validation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Repository Statistics](#2-repository-statistics)
3. [File Change Patterns](#3-file-change-patterns)
4. [Co-Change Analysis](#4-co-change-analysis)
5. [Author Analysis](#5-author-analysis)
6. [Module Structure](#6-module-structure)
7. [Test-Implementation Coupling](#7-test-implementation-coupling)
8. [Code Hotspots & Churn](#8-code-hotspots--churn)
9. [File Renames & History](#9-file-renames--history)
10. [Bulk Commits Analysis](#10-bulk-commits-analysis)
11. [Deleted Files](#11-deleted-files)
12. [Validation Test Cases](#12-validation-test-cases)
13. [Generated Files Index](#13-generated-files-index)

---

## 1. Executive Summary

### Key Findings

| Metric | Value | Notes |
|--------|-------|-------|
| **Total Commits** | 5,971 | From 2024-03-13 to 2026-01-30 |
| **Current Files** | 2,765 | At HEAD |
| **Historical Files** | 9,030 | Ever existed |
| **Deleted Files** | 6,265 | ~70% file turnover |
| **Unique Authors** | 459 | Contributors |
| **Bus Factor** | 7 | Authors covering 50% of commits |
| **Merge Commits** | 1 | Minimal merges (squash-merge workflow) |
| **Renames Detected** | 1,541 | File path changes |
| **Bulk Commits (>50 files)** | 75 | Major refactors/migrations |

### Repository Characteristics

- **Active Development**: ~690 days of history with 5,971 commits (~8.6 commits/day average)
- **High Contributor Base**: 459 unique authors with healthy distribution
- **Major Rename Event**: Project renamed from "OpenDevin" to "OpenHands" in Aug 2024
- **Significant File Churn**: ~2M lines of code churn across all files
- **Strong Test Discipline**: 526 test files identified, many with high coupling to implementations

---

## 2. Repository Statistics

### Basic Counts

```json
{
  "total_commits": 5971,
  "merge_commits": 1,
  "non_merge_commits": 5970,
  "current_files_count": 2765,
  "unique_authors": 459
}
```

### File Types at HEAD

| Type | Count | Percentage |
|------|-------|------------|
| Python (.py) | 1,254 | 45.4% |
| TypeScript/JavaScript | 958 | 34.6% |
| Test Files | 526 | 19.0% |
| Markdown | 138 | 5.0% |

### Folder Structure

- **Max folder depth**: 7 levels
- **Top-level folders**: 16

---

## 3. File Change Patterns

### Top 20 Most Changed Files (Hotspots)

| Rank | File | Commits |
|------|------|---------|
| 1 | poetry.lock | 748 |
| 2 | frontend/package-lock.json | 525 |
| 3 | frontend/package.json | 522 |
| 4 | pyproject.toml | 446 |
| 5 | README.md | 251 |
| 6 | frontend/src/i18n/translation.json | 244 |
| 7 | openhands/llm/llm.py | 159 |
| 8 | frontend/src/i18n/declaration.ts | 150 |
| 9 | openhands/controller/agent_controller.py | 138 |
| 10 | openhands/runtime/base.py | 120 |
| 11 | openhands/server/routes/manage_conversations.py | 119 |
| 12 | openhands/server/session/session.py | 111 |
| 13 | openhands/server/session/agent_session.py | 108 |
| 14 | opendevin/controller/agent_controller.py | 107 |
| 15 | openhands/events/action/action.py | 90 |
| 16 | openhands/core/config/app_config.py | 88 |
| 17 | openhands/runtime/impl/eventstream/eventstream_runtime.py | 86 |
| 18 | openhands/agenthub/codeact_agent/codeact_agent.py | 85 |
| 19 | openhands/server/app.py | 82 |
| 20 | tests/unit/test_agent_controller.py | 81 |

### Observations

1. **Dependency files dominate**: poetry.lock and package-lock.json are the most changed files (dependency updates)
2. **Core components are hotspots**: agent_controller.py, llm.py, and runtime/base.py have high change frequency
3. **i18n files are active**: Translation files have significant churn from localization efforts
4. **Historical paths present**: Files with `opendevin/` paths still appear due to rename history

---

## 4. Co-Change Analysis

### Top 20 Co-Changed File Pairs

| Rank | File A | File B | Co-changes |
|------|--------|--------|------------|
| 1 | frontend/package-lock.json | frontend/package.json | 498 |
| 2 | poetry.lock | pyproject.toml | 312 |
| 3 | frontend/src/i18n/declaration.ts | frontend/src/i18n/translation.json | 138 |
| 4 | frontend/package-lock.json | pyproject.toml | 86 |
| 5 | frontend/package.json | pyproject.toml | 85 |
| 6 | README.md | pyproject.toml | 60 |
| 7 | README.md | frontend/package.json | 59 |
| 8 | README.md | frontend/package-lock.json | 57 |
| 9 | Development.md | containers/dev/compose.yml | 56 |
| 10 | Development.md | pyproject.toml | 56 |

### Coupling Patterns Identified

1. **Lock file coupling**: Package lock files always change with their manifests (expected)
2. **i18n pair**: declaration.ts and translation.json are tightly coupled (138 co-changes)
3. **Development setup**: Development.md changes with multiple infrastructure files
4. **Cross-stack changes**: Python and frontend configs often change together in releases

### Total Co-Change Statistics

- **Total pairs with ≥3 co-changes**: 14,467
- **Strong coupling pairs (Jaccard > 0.3)**: 125
- **Very strong coupling (Jaccard > 0.5)**: 47

---

## 5. Author Analysis

### Top 10 Contributors

| Rank | Author | Commits | Percentage |
|------|--------|---------|------------|
| 1 | dependabot[bot] | 934 | 15.64% |
| 2 | accounts@rbren.io | 474 | 7.94% |
| 3 | xingyao@all-hands.dev | 414 | 6.93% |
| 4 | tofarr@gmail.com | 388 | 6.50% |
| 5 | amanape | 367 | 6.15% |
| 6 | enyst | 299 | 5.01% |
| 7 | neubig@gmail.com | 291 | 4.87% |
| 8 | hieptl | 286 | 4.79% |
| 9 | mamoodiha@gmail.com | 283 | 4.74% |
| 10 | rohitvinodmalhotra@gmail.com | 280 | 4.69% |

### Contribution Distribution

- **Top 1 contributor share**: 15.64% (dependabot - automated)
- **Top 5 contributors share**: 43.16%
- **Top 10 contributors share**: 67.27%
- **Bus Factor**: 7 (authors needed to cover 50% of commits)

### Observations

1. **Dependabot dominates**: ~16% of commits are automated dependency updates
2. **Healthy distribution**: No single human contributor over 8%
3. **Active core team**: Top 10 human contributors cover ~52% of work
4. **Open source health**: 459 contributors indicates strong community engagement

---

## 6. Module Structure

### Module Commit Activity

| Module | Files | Commits |
|--------|-------|---------|
| Root (.) | 26 | 5,967 |
| openhands/ | 570 | 1,843 |
| frontend/ | 1,024 | 1,812 |
| tests/ | 218 | 979 |
| .github/ | 22 | 438 |
| evaluation/ | 328 | 408 |
| enterprise/ | 421 | 183 |
| containers/ | 11 | 171 |

### Module Boundaries

The repository has clear architectural boundaries:

1. **Backend Core** (`openhands/`): Python backend with 570 files, 1,843 commits
2. **Frontend** (`frontend/`): React/TypeScript UI with 1,024 files, 1,812 commits
3. **Testing** (`tests/`): 218 test files with 979 commits
4. **Evaluation** (`evaluation/`): Benchmark suite with 328 files
5. **Enterprise** (`enterprise/`): Enterprise-specific code (newer module)

### Cross-Module Observations

- Frontend and backend have similar commit velocity
- Enterprise module is newer with lower commit count relative to file count
- Evaluation suite is self-contained with distinct file patterns

---

## 7. Test-Implementation Coupling

### High Coupling Test-Implementation Pairs

| Test File | Implementation | Jaccard |
|-----------|----------------|---------|
| test_github_v1_callback_processor.py | github_v1_callback_processor.py | 1.0 |
| test_jira_view.py | jira_view.py | 1.0 |
| test_jira_dc_view.py | jira_dc_view.py | 1.0 |
| test_linear_view.py | linear_view.py | 1.0 |
| test_slack_v1_callback_processor.py | slack_v1_callback_processor.py | 1.0 |
| test_orgs.py | orgs.py | 1.0 |
| test_microagent_base.py | microagent_base.py | 1.0 |

### Test Coverage Statistics

- **Total test files identified**: 438
- **Matched test-impl pairs**: 66
- **High coupling pairs (Jaccard > 0.3)**: 53
- **Average Jaccard for matched pairs**: 0.8

### Test Discipline Findings

1. **Enterprise module has excellent test discipline**: Most test files have Jaccard=1.0 with implementations
2. **Naming convention followed**: test_*.py pattern consistently used
3. **Co-located tests**: Enterprise tests are well-organized in parallel test directories

---

## 8. Code Hotspots & Churn

### Top 20 Files by Code Churn

| Rank | File | Commits | Churn (lines) | Exists |
|------|------|---------|---------------|--------|
| 1 | frontend/package-lock.json | 525 | 263,137 | ✓ |
| 2 | poetry.lock | 748 | 127,832 | ✓ |
| 3 | docs/package-lock.json | 39 | 58,684 | ✗ |
| 4 | docs/yarn.lock | 13 | 56,246 | ✗ |
| 5 | frontend/src/i18n/translation.json | 244 | 51,210 | ✓ |
| 6 | frontend/pnpm-lock.yaml | 7 | 35,006 | ✗ |
| 7 | enterprise/poetry.lock | 37 | 27,884 | ✓ |

### Total Churn Statistics

- **Total files with changes**: 7,546
- **Total churn**: 1,939,110 lines (insertions + deletions)

### Churn Patterns

1. **Lock files dominate churn**: Auto-generated dependency files have highest churn
2. **Deleted lock files present**: docs/ package managers were removed
3. **Translation file active**: i18n/translation.json has significant ongoing churn

---

## 9. File Renames & History

### Rename Statistics

- **Total renames detected**: 1,541
- **Rename detection threshold**: 90% similarity

### Notable Rename Events

| Old Path | New Path | Similarity |
|----------|----------|------------|
| .openhands/microagents/repo.md | AGENTS.md | 100% |
| frontend/src/state/*.ts | frontend/src/stores/*.ts | 100% |
| opendevin/** | openhands/** | Various |

### Major Project Rename

The most significant rename event was the **OpenDevin → OpenHands** rename in August 2024:

- **Commit**: `01ae22ef57d497f7cfdfba96a99b96af06be5a05`
- **Files affected**: 387
- **Date**: 2024-08-20
- **Impact**: All `opendevin/` paths became `openhands/`

### Rename Chain Examples

Some files have been renamed multiple times:
- Migration version files get renumbered frequently
- State management files moved from `state/` to `stores/`

---

## 10. Bulk Commits Analysis

### Bulk Commits (>50 files changed)

| Rank | Subject | Files | Date |
|------|---------|-------|------|
| 1 | Rename OpenDevin to OpenHands | 387 | 2024-08-20 |
| 2 | Support integration tests using EventStream Runtime | 369 | 2024-08-01 |
| 3 | Migrate all docs from All-Hands-AI/docs | 342 | 2025-06-03 |
| 4 | Enterprise code and docker build | 327 | 2025-09-04 |
| 5 | Update pre-commit hook versions | 296 | 2025-05-08 |

### Statistics

- **Total bulk commits (>50 files)**: 75
- **Average files per bulk commit**: ~150

### Bulk Commit Categories

1. **Renames/Restructures**: Project rename, directory reorganizations
2. **Large feature adds**: Enterprise module, new integrations
3. **Tooling updates**: Pre-commit hooks, linter rule changes
4. **Documentation migrations**: Moving docs between repositories

### LFCA Implications

These bulk commits should be:
- **Downweighted** in coupling calculations to avoid spurious edges
- **Excluded** or treated specially in analysis
- **Flagged** for manual review when detected

---

## 11. Deleted Files

### Deletion Statistics

| Metric | Value |
|--------|-------|
| Historical files ever existed | 9,030 |
| Current files at HEAD | 2,765 |
| Deleted files | 6,265 |
| Deletion rate | ~69% |

### Sample Deleted File Categories

1. **Old module paths**: `opendevin/**` (renamed to openhands)
2. **Test mocks**: Integration test mock files
3. **Documentation**: Moved to separate repository
4. **Build artifacts**: Accidentally committed files

### Implications for LFCA

- Deleted file handling is critical with 69% file turnover
- Historical coupling analysis must account for path renames
- `exists_at_head` flag is essential for meaningful results

---

## 12. Validation Test Cases

### Test Case 1: Lock File Coupling

**Hypothesis**: package.json and package-lock.json should have near-perfect coupling

**Ground Truth**:
- Co-changes: 498
- Expected Jaccard: >0.9

**LFCA Validation**: Check that these files appear as top coupled pair

### Test Case 2: Rename Continuity

**Hypothesis**: opendevin/controller/agent_controller.py and openhands/controller/agent_controller.py should be treated as same file

**Ground Truth**:
- Same logical file, renamed
- Combined commits: 107 + 138 = 245

**LFCA Validation**: Verify rename tracking unifies commit history

### Test Case 3: Test-Implementation Coupling

**Hypothesis**: test_jira_view.py should have high coupling with jira_view.py

**Ground Truth**:
- Both files have 6 commits
- All 6 commits are shared
- Jaccard = 1.0

**LFCA Validation**: Verify coupling score matches ground truth

### Test Case 4: Bulk Commit Downweighting

**Hypothesis**: Files only connected via bulk commits should have low coupling

**Example**: Files in the OpenDevin→OpenHands rename commit

**Ground Truth**:
- 387 files changed together once
- Without downweighting: strong spurious coupling
- With downweighting: coupling score should be negligible

**LFCA Validation**: Verify `max_changeset_size` and downweighting work correctly

### Test Case 5: Module Boundaries

**Hypothesis**: Files in different modules should have lower coupling than same-module files

**Ground Truth**:
- openhands/llm/llm.py should couple more with openhands/ files
- Less coupling expected with frontend/ files

**LFCA Validation**: Verify clustering respects module boundaries

---

## 13. Generated Files Index

### JSON Files

| Filename | Description |
|----------|-------------|
| basic_stats.json | Basic repository statistics |
| file_commits.json | File commit counts (top 100) |
| cochange_pairs.json | Co-change pairs (top 500) |
| renames.json | File renames with similarity scores |
| bulk_commits.json | Commits with >50 files |
| deleted_files.json | Deleted file information |
| author_analysis.json | Author contribution analysis |
| module_analysis.json | Module/folder statistics |
| test_impl_coupling.json | Test-implementation pairs |
| coupling_ground_truth.json | Detailed coupling metrics |
| hotspot_analysis.json | Code churn analysis |
| qa_summary.json | Summary of all generated files |

### CSV Files

| Filename | Description |
|----------|-------------|
| file_commits.csv | All file commit counts |
| cochange_pairs.csv | All co-change pairs |
| renames.csv | All rename operations |
| bulk_commits.csv | Bulk commit details |
| deleted_files.csv | Deleted files with last commit |
| author_stats.csv | Author statistics |
| folder_stats.csv | Folder-level statistics |
| test_impl_pairs.csv | Test-implementation pairs |
| coupling_ground_truth.csv | Coupling metrics for validation |
| file_churn.csv | File churn data |

### Usage

Load these files for LFCA validation:

```python
import json
import pandas as pd

# Load JSON
with open('QA/output/openhands/coupling_ground_truth.json') as f:
    ground_truth = json.load(f)

# Load CSV
file_commits = pd.read_csv('QA/output/openhands/file_commits.csv')
cochange_pairs = pd.read_csv('QA/output/openhands/cochange_pairs.csv')
```

---

## Summary

The OpenHands repository provides an excellent test case for LFCA due to its:

1. **Rich history**: 5,971 commits over ~2 years
2. **File evolution**: 69% file turnover with renames
3. **Clear coupling patterns**: Lock files, test-impl pairs
4. **Bulk operations**: Project rename and large refactors
5. **Multi-language**: Python backend + TypeScript frontend
6. **Healthy contributor base**: 459 authors

Key validation points:
- Rename tracking must unify OpenDevin→OpenHands paths
- Bulk commit downweighting should prevent spurious coupling
- Test-implementation coupling should match high Jaccard pairs
- Module boundaries should be reflected in clustering

---

*This report was generated automatically from git history analysis.*
