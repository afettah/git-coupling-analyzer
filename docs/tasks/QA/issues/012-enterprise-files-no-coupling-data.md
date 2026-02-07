# Issue: Enterprise module files have no coupling data from API despite ground truth

**Severity:** High  
**Date:** 2026-02-07  
**Status:** Open  
**Component:** Analysis / Coupling Detection

## Description

Files in the `enterprise/` directory that have known perfect coupling (jaccard=1.0) in the git ground truth return empty coupling results from the API.

## Evidence

Ground truth (from `coupling_ground_truth.json`):
- `enterprise/integrations/jira/jira_view.py` ↔ `enterprise/tests/unit/integrations/jira/test_jira_view.py` — jaccard=1.0 (6 co-commits)

API result:
```bash
curl -s "http://localhost:8000/repos/openhands/coupling?path=enterprise/integrations/jira/jira_view.py"
# Returns: [] (empty)
```

## Scope

This affects 20+ known high-coupling pairs in the enterprise module, all of which have jaccard=1.0 in git ground truth but show no coupling in the API.

## Likely Cause

These files have relatively few commits (3-7) and the `min_cooccurrence=5` filter or `min_revisions=5` filter may be dropping them. The analysis config shows `min_cooccurrence: 5`, meaning pairs with fewer than 5 co-occurrences are dropped even if they have 100% co-change rate.

## Recommendation

Consider using a relative threshold (e.g., jaccard >= 0.8 regardless of count) in addition to absolute minimum co-occurrence.
