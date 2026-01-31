# Subtask: Graph Enhancements

**Status:** Not Started  
**Priority:** Medium  
**Effort:** 4 days

---

## Goal

Enhance graph visualizations with node sizing, progressive exploration, and directional coupling.

---

## Tasks

### Node Sizing
- [ ] Add "Size by" selector (commits, churn, coupling-degree, authors)
- [ ] Implement dynamic radius calculation
- [ ] Add legend for size scale

### Progressive Exploration
- [ ] Add "Progressive Mode" toggle
- [ ] Start with single node, expand on click
- [ ] Show "[+N more]" badges
- [ ] Depth control (1-3 hops)

### Directional Coupling
- [ ] Show arrows for asymmetric relationships
- [ ] Display P(B|A) vs P(A|B) on edges
- [ ] Add direction legend

### Snapshot Comparison
- [ ] Side-by-side diff view
- [ ] Highlight new/removed/changed clusters
- [ ] Show modularity score delta

---

## Design: Node Sizing

```
┌─────────────────────────────────────────────────────────────────┐
│  Size nodes by: [Commits ▼]  Color by: [Coupling strength ▼]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                         ●                                        │
│                    (auth.py)                                     │
│                    234 commits                                   │
│                                                                  │
│            ◉                         ◉                          │
│       (session.py)              (user_svc.py)                   │
│       89 commits                 156 commits                     │
│                                                                  │
│  Legend:                                                         │
│  ● = 1-50 commits  ◉ = 51-150 commits  ● = 151+ commits         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Sizing Options

| Metric | Description |
|--------|-------------|
| `commits` | Number of commits touching file |
| `churn` | Lines added + deleted |
| `coupling-degree` | Number of coupled files |
| `coupling-strength` | Sum of coupling weights |
| `authors` | Number of distinct authors |
| `centrality` | Graph centrality score |
| `uniform` | All same size |

---

## Relevant Files

- `frontend/src/components/ImpactGraph.tsx`
- `frontend/src/components/clustering/views/ClustersTab.tsx`
