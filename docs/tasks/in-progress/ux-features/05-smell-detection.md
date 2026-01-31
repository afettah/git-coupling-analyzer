# Subtask: Architectural Smell Detection

**Status:** Not Started  
**Priority:** Low  
**Effort:** 5 days

---

## Goal

Auto-detect and flag common architectural anti-patterns based on coupling data.

---

## Tasks

- [ ] Define smell detection algorithms
- [ ] Implement detection in `lfca/insights.py`
- [ ] Create API endpoint for smells
- [ ] Build `ArchitecturalSmells.tsx` component
- [ ] Add severity classification (high/medium/low)
- [ ] Include suggestions for remediation

---

## Smell Definitions

| Smell | Severity | Detection Rule | Suggestion |
|-------|----------|----------------|------------|
| **God Class** | High | File coupled with >30 files AND top 5% commits | Split into domain-specific modules |
| **Shotgun Surgery** | Medium | Avg cascade size >8 files | Introduce observer/event pattern |
| **Layer Violation** | Medium | Different layers coupled with Jaccard >0.3 | Add abstraction layer |
| **Divergent Change** | Medium | File changes for >5 distinct reasons | Split by responsibility (SRP) |
| **Orphan File** | Low | Max coupling <0.1 AND >10 commits | Review if still needed |
| **Circular Dependency** | High | Strong bidirectional coupling in cluster | Break with DI or events |

---

## Design

```
┌─────────────────────────────────────────────────────────────────┐
│  🚨 Detected Architectural Smells (5)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🔴 HIGH SEVERITY                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ God Class: src/services/UserService.ts                     │ │
│  │ • Coupled with 47 files across 8 modules                   │ │
│  │ • Changed in 234 commits (top 1%)                          │ │
│  │ • Suggestion: Split into domain-specific services          │ │
│  │                                            [View details]  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  🟡 MEDIUM SEVERITY                                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Shotgun Surgery: User entity changes                       │ │
│  │ • Changing User.ts triggers changes in 12+ files           │ │
│  │ • Suggestion: Introduce observer/event pattern             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Relevant Files

- `lfca/insights.py` (new)
- `lfca/api.py`
- `frontend/src/components/ArchitecturalSmells.tsx` (new)
