# Task: Miscellaneous Issues

**Status:** Open  
**Priority:** Low  
**Last Updated:** January 31, 2026

---

## Summary

Small issues and technical debt items that don't warrant their own task files.

---

## Issues

### 1. Polling Optimization

**Problem:** `/repos/{id}/analysis/status` is called continuously even after project is complete.

**Solution:** Stop polling when status is "complete" or "error".

**Files:**
- `frontend/src/components/AnalysisDashboard.tsx`
- `frontend/src/api.ts`

---

### 2. Database Architecture Evaluation

**Problem:** Evaluate if current SQLite/Parquet architecture is optimal.

**Current State:**
- SQLite for metadata
- Parquet for edges (columnar, fast queries)

**Alternative Options:**
- Neo4j, DGraph (graph databases)
- In-memory graph structure

**Considerations:**
- Query patterns
- Performance at scale
- Complexity vs benefit

---

## Relevant Files

- [frontend/src/components/AnalysisDashboard.tsx](../../../frontend/src/components/AnalysisDashboard.tsx)
- [lfca/storage.py](../../../lfca/storage.py)
