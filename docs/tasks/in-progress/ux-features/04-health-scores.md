# Subtask: Health Scores

**Status:** Not Started  
**Priority:** Medium  
**Effort:** 3 days

---

## Goal

Add composite health scores for files and folders with breakdown and recommendations.

---

## Tasks

### Backend
- [ ] Define health score algorithm (fixed, not configurable)
- [ ] Compute scores during analysis phase
- [ ] Store in `file_hints` / `folder_hints` tables
- [ ] Add trends (comparison to previous period)

### Frontend
- [ ] Create `HealthScoreCard.tsx` component
- [ ] Display score breakdown with progress bars
- [ ] Show recommendations
- [ ] Display trend indicator (improving/stable/degrading)

---

## Score Components

| Component | Weight | Calculation |
|-----------|--------|-------------|
| **Internal Cohesion** | 25% | Files within folder change together |
| **External Coupling** | 25% | Low external coupling = better encapsulation |
| **Change Stability** | 25% | Consistent change patterns |
| **Author Concentration** | 25% | Distributed ownership = healthier |

---

## Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Health Score: src/auth/                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│         ┌─────────────────────────┐                             │
│         │          72             │  🟡 Moderate                │
│         │        / 100            │                             │
│         └─────────────────────────┘                             │
│                                                                  │
│  📊 Score Breakdown                                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Internal Cohesion        ████████████████████░░░░  85/100  │ │
│  │ External Coupling        ████████████░░░░░░░░░░░░  55/100  │ │
│  │ Change Stability         ██████████████████░░░░░░  78/100  │ │
│  │ Author Concentration     ████████████████░░░░░░░░  70/100  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  🎯 Recommendations                                              │
│  • High external coupling with src/database/ - consider facade  │
│  • 3 files have no internal coupling - misplaced?               │
│                                                                  │
│  📈 Trend: ▼ -5 pts from last month (improving)                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Relevant Files

- `lfca/insights.py` (new or existing)
- `frontend/src/components/shared/HealthScoreCard.tsx` (new)
- `frontend/src/components/FolderTree.tsx`
