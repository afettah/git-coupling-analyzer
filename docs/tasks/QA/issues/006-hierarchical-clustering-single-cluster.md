# Issue: Hierarchical clustering returns only 1 cluster containing all files

**Severity:** Medium  
**Date:** 2026-02-07  
**Status:** Open  
**Component:** Clustering - Hierarchical Algorithm

## Description

Hierarchical clustering with default parameters puts all files into a single cluster, making the result useless for analysis.

## Reproduction

```bash
curl -s -X POST "http://localhost:8000/repos/openhands/clustering/run" \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "hierarchical", "min_weight": 0.1}'
```

## Result

```
cluster_count=1 (containing all ~2065 files)
```

## Expected

5-50 meaningful clusters based on the QA spec (QA-2.md expects 10-30 for hierarchical with linkage=ward).

## Possible Causes

- Default distance threshold too permissive
- Missing `n_clusters` parameter passthrough
- Ward linkage not being used by default
