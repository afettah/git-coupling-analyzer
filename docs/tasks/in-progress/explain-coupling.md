# Task: Explain Coupling

**Status:** Partially Implemented  
**Priority:** Medium  
**Last Updated:** January 31, 2026

---

## Summary

Help users understand why files are coupled by showing the underlying commit evidence.

---

## What Has Been Done

- ✅ Edge metrics calculation (Jaccard, weighted Jaccard, P(A|B), P(B|A))
- ✅ Author time window grouping in changesets
- ✅ Impact Graph UI with Top Impacts sidebar
- ✅ Metrics documentation with formulas

---

## What Needs To Be Done

### Evidence Panel
- [ ] Create UI panel showing commit details for an edge
- [ ] Display commit IDs, authors, messages
- [ ] Show line changes per file per commit
- [ ] Add click handler on edges in ImpactGraph

### Backend Endpoint
- [ ] Create `/repos/{id}/coupling/{file_a}/{file_b}/commits`
- [ ] Return list of commits that contributed to coupling
- [ ] Currently only `pair_count` stored, not individual commit IDs

### Time-Window Analysis
- [ ] Add "Lifetime" vs "Recent" coupling toggle
- [ ] Date range filter for edges
- [ ] Show if relationships are improving/worsening

---

## Metrics Reference

| Metric | Formula | High Value | Low Value |
|--------|---------|------------|-----------|
| **Co-occurrence** | Count of shared commits | Strong lifecycle link | Rare/accidental |
| **Jaccard** | (A ∩ B) / (A ∪ B) | "Twins" – always together | Independent lives |
| **P(B\|A)** | (A ∩ B) / Commits(A) | Change A → likely change B | A independent |
| **Weighted Jaccard** | Small commits weighted more | Focused relationship | Noisy bulk changes |

---

## Relevant Files

- [lfca/edges.py](../../../lfca/edges.py)
- [lfca/config.py](../../../lfca/config.py)
- [frontend/src/components/ImpactGraph.tsx](../../../frontend/src/components/ImpactGraph.tsx)
