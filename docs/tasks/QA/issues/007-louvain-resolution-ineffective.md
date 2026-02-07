# Issue: Louvain resolution parameter has almost no effect on cluster count

**Severity:** Medium  
**Date:** 2026-02-07  
**Status:** Open  
**Component:** Clustering - Louvain Algorithm

## Description

Changing the Louvain `resolution` parameter from 0.5 to 2.0 (4x increase) barely changes the cluster count. Most clusters are singletons.

## Evidence

| Resolution | Cluster Count | Avg Size |
|-----------|--------------|----------|
| 0.5       | 1849         | ~1.1     |
| 1.0 (default) | 1851    | 1.1      |
| 2.0       | 1868         | ~1.1     |

Expected per QA-2.md:
- resolution=0.5 → 5-15 clusters
- resolution=2.0 → 20-50 clusters

## Impact

With ~1850 clusters for ~2065 files, most clusters contain exactly 1 file (singleton). This means clustering is not finding meaningful communities.

## Possible Causes

- The coupling graph is too sparse (only 2846 edges for 4450 files)
- `min_weight=0.1` is filtering too many edges
- The resolution parameter is not being passed correctly to the community detection library
