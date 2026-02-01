# Issue #002: Louvain Clustering - Average Coupling Shows 0%

## Description
When running Louvain clustering algorithm, the "Average coupling" metric displays 0% in the snapshot header and table, while the DBSCAN algorithm correctly displays meaningful coupling percentages (e.g., 72%).

## Severity
**High** - Critical metric is not displayed correctly for one of the main algorithms

## Reproducibility
**Always**

## Likelihood
**Likely Real Issue** - Consistently fails for Louvain but works for DBSCAN

## URL
- `http://localhost:5173/repos/openhands/clustering/louvain_baseline_test_20260201_020132`
- `http://localhost:5173/repos/openhands/clustering` (Snapshots list showing "Avg Coupling: 0%")

## Expected Result
For Louvain clustering with default parameters (resolution=1.0, min_weight=0.1):
- Average coupling should display a meaningful percentage (e.g., 15-50% range)
- The metric should reflect the average Jaccard similarity across all clusters
- Should be non-zero unless the graph has no edges

Example from DBSCAN test:
- Algorithm: dbscan (eps=0.5, min_samples=2)
- Average coupling: **72%** ✓ (correct)
- Cluster count: 2
- Files: 7

## Current Result
Louvain clustering:
- Algorithm: louvain (resolution=1.0, min_weight=0.1)
- Average coupling: **0%** ✗ (incorrect)
- Cluster count: 444
- Files: 451

## Steps to Reproduce
1. Navigate to OpenHands project > Clustering tab
2. Click "Run New Analysis"
3. Keep default settings (Louvain algorithm with resolution=1.0)
4. Name the snapshot "Test Louvain"
5. Click "Run Clustering"
6. Wait for completion
7. Observe the "Average coupling:" field at the top
8. Compare with DBSCAN results which show correct percentages

## Algorithm Comparison
| Algorithm | Average Coupling | Expected | Status |
|-----------|-----------------|----------|--------|
| Louvain (resolution=1.0) | 0% | 15-50% | ✗ FAIL |
| DBSCAN (eps=0.5) | 72% | 50-80% | ✓ PASS |

## Additional Notes
- The Louvain clustering correctly identifies 444 clusters (expected for sparse graphs)
- The clustering structure appears correct (files are grouped appropriately)
- Issue is isolated to the average coupling calculation for Louvain results
- Likely a backend issue in the coupling calculation when merging cluster averages
- The "Coupling range" filter shows 5%-100% range, suggesting some edges have coupling data
