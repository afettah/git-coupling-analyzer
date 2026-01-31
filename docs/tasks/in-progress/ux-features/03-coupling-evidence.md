# Subtask: Coupling Evidence Panel

**Status:** Not Started  
**Priority:** High  
**Effort:** 4 days

---

## Goal

Add drill-down panel showing specific commits that created a coupling relationship ("Why are these files coupled?").

---

## Tasks

### Backend
- [ ] Create `GET /repos/{id}/coupling/{file_a}/{file_b}/evidence` endpoint
- [ ] Return shared commits with author, message, line changes
- [ ] Include contributing authors breakdown
- [ ] Add coupling timeline data

### Frontend
- [ ] Create `CouplingEvidencePanel.tsx` component
- [ ] Add click handler on edges in ImpactGraph
- [ ] Display metrics summary (Jaccard, co-occurrence, P(B|A))
- [ ] Show commit list with filtering
- [ ] Add "Coupling Over Time" mini chart

---

## API Response Schema

```python
@dataclass
class CouplingEvidence:
    file_a: FileInfo
    file_b: FileInfo
    metrics: CouplingMetrics
    contributing_authors: list[AuthorContribution]
    shared_commits: list[SharedCommit]
    timeline: CouplingTimeline

@dataclass  
class SharedCommit:
    oid: str
    message: str
    author: str
    author_email: str
    timestamp: str
    changes_a: ChangeStats
    changes_b: ChangeStats
    total_files_in_commit: int
```

---

## Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Coupling Evidence: auth.py ↔ user_service.py                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📊 Metrics Summary                                              │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐  │
│  │ Co-occur: 47 │ Jaccard: 0.72│ P(B|A): 0.89 │ P(A|B): 0.64 │  │
│  └──────────────┴──────────────┴──────────────┴──────────────┘  │
│                                                                  │
│  👥 Top Contributing Authors                                     │
│  ├─ john.doe@company.com (23 shared commits)                    │
│  ├─ jane.smith@company.com (15 shared commits)                  │
│  └─ bob.wilson@company.com (9 shared commits)                   │
│                                                                  │
│  📝 Recent Shared Commits                                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ abc123f  "Add OAuth2 support"           john.doe  2d ago   │ │
│  │          Changed: +45 auth.py, +32 user_service.py         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                [View all 47 →]   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Relevant Files

- `lfca/api.py`
- `lfca/schema.py`
- `frontend/src/components/ImpactGraph.tsx`
- `frontend/src/components/CouplingEvidencePanel.tsx` (new)
