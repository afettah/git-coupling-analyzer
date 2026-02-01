# Issue: Verify Coupling Calculation Accuracy Against Ground Truth

**Severity**: Low (Informational)
**Reproducibility**: Always
**Likelihood**: Likely

## Description
Need to verify that coupling calculations (Jaccard similarity, co-occurrence counts) match expected ground truth values for known file pairs. This is a validation test rather than a bug report, but documents expected metrics.

## Test Case 1: Package.json vs Package-lock.json

**Expected Ground Truth**:
- Jaccard similarity: ~0.9365 ✓ Confirmed
- Pair count: ~59 ✓ Confirmed
- p_dst_given_src: ~0.967 ✓ Confirmed

**Actual**:
```json
{
  "file_id": 134,
  "path": "frontend/package-lock.json",
  "pair_count": 59.0,
  "jaccard": 0.9365079365079365,
  "p_dst_given_src": 0.9672131147540983,
  "p_src_given_dst": 0.9672131147540983
}
```

**Status**: ✓ PASS - Metrics match expected values

## Test Case 2: Docker Compose Files

**Expected Pairing**: 
- frontend/package.json ↔ containers/dev/compose.yml
- Jaccard: ~0.82 ✓ Confirmed
- Pair count: ~50 ✓ Confirmed

**Status**: ✓ PASS

## Verification Method
Spot-check coupling metrics against:
1. OpenHands repository QA data in `/QA/output/openhands/`
2. Git log analysis for co-occurrence patterns
3. Business logic expectations (config files should couple together)

---
**Created**: 2026-02-01T14:40:45Z
