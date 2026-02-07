# Issue: Coupling Jaccard values differ significantly from git ground truth

**Severity:** High  
**Date:** 2026-02-07  
**Status:** Open  
**Component:** Edge Computation / Coupling Analysis

## Description

Jaccard coupling values from the API differ significantly from values computed directly from git history for known high-coupling pairs.

## Evidence

| Pair | Git Ground Truth | API Value | Diff |
|------|-----------------|-----------|------|
| frontend/package.json ↔ package-lock.json | 0.936 | 0.598 | -0.338 |
| containers/dev/compose.yml ↔ docker-compose.yml | 0.723 | 0.807 | +0.084 |
| pyproject.toml ↔ poetry.lock | ~0.50+ | 0.519 | OK |

## Most Concerning

`frontend/package.json ↔ frontend/package-lock.json`:
- **Git:** These files change together in ~93.6% of their combined commits  
- **API:** Reports only 59.8% coupling
- This is the most obviously coupled pair in any frontend project

## Commit Counts in DB vs Git

| File | Git Commits | DB total_commits |
|------|------------|-----------------|
| pyproject.toml | 446 | 426 |
| frontend/package.json | 522 | 506 |
| frontend/package-lock.json | 525 | 113 |

The `frontend/package-lock.json` shows only 113 commits in DB vs 525 in git - many commits likely filtered by `max_changeset_size=50` since lock file changes often accompany large dependency updates.

## Root Cause

The `max_changeset_size=50` filter drops commits with >50 files. Lock file updates (package-lock.json, poetry.lock) often occur in large commits and get disproportionately filtered, reducing co-occurrence counts.

## Impact

Core coupling pairs are under-reported, undermining the primary value of the tool.
