# Subtask: Glossary Tooltip System

**Status:** Not Started  
**Priority:** Medium  
**Effort:** 2 days

---

## Goal

Create a tooltip system with plain-English explanations for technical terms (Jaccard, Co-occurrence, P(B|A), etc.).

---

## Tasks

- [ ] Create `GlossaryTooltip.tsx` component
- [ ] Define glossary entries with:
  - Short explanation
  - Long explanation
  - Formula (optional)
  - Example interpretation
- [ ] Add info icon (ⓘ) next to technical terms
- [ ] Integrate throughout UI (ImpactGraph, ClusteringView, etc.)

---

## Glossary Terms

| Term | Plain English | Technical |
|------|---------------|-----------|
| **Jaccard** | "How often these files are twins" | Intersection over union of commit sets |
| **Co-occurrence** | "Times changed in same commit" | Raw count of shared commits |
| **P(B\|A)** | "If you touch A, how likely you'll touch B" | Conditional probability |
| **Weighted Jaccard** | "Jaccard, but small commits count more" | Downweighted by commit size |
| **Cluster** | "Group of related files" | Community detected by graph algorithm |
| **Churn** | "How much code changed" | Lines added + deleted |

---

## Design

```
┌──────────────────────────────────────────────────────┐
│  Jaccard: 0.72  ⓘ                                    │
│  ┌────────────────────────────────────────────────┐  │
│  │ Jaccard Index                                  │  │
│  │                                                │  │
│  │ How similar two files are based on when they  │  │
│  │ change together.                              │  │
│  │                                                │  │
│  │ 🔢 Formula: (A ∩ B) / (A ∪ B)                 │  │
│  │                                                │  │
│  │ 0.72 = "These files change together 72% of   │  │
│  │        the time when either one changes"      │  │
│  │                                                │  │
│  │ [Learn more →]                                │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## Relevant Files

- `frontend/src/components/shared/GlossaryTooltip.tsx` (new)
- `frontend/src/components/ImpactGraph.tsx`
- `frontend/src/components/clustering/`
