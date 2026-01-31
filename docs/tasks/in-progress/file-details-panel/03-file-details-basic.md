# Subtask: File Details Panel - Basic

**Status:** Not Started  
**Effort:** 3 days

---

## Goal

Create the basic file details panel structure with tabs and stats cards.

---

## Tasks

- [ ] Create `FileDetailsPanel.tsx` component
- [ ] Panel opens as tab in main content area

### Header Section
- [ ] File icon and name
- [ ] Full path subtitle
- [ ] Action buttons: Open in Repo, Blame, Copy Path, Bookmark

### Stats Cards Row
- [ ] 📊 **Commits** — Total count, recent (30d)
- [ ] 👥 **Authors** — Count, top author
- [ ] 📅 **Age** — First commit date, age string
- [ ] 🔗 **Coupling** — Coupled file count, max coupling %
- [ ] ➕ **Additions** — Total lines added, net
- [ ] ➖ **Deletions** — Total lines deleted
- [ ] 📏 **Churn Rate** — Changes per week
- [ ] ⚠️ **Risk Score** — Calculated score (0-100)

### Tab Navigation
- [ ] Activity tab (default)
- [ ] Authors tab
- [ ] Coupling tab
- [ ] Commits tab
- [ ] Insights tab

---

## Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 📄 DataTable.tsx                                               [✕]     │
│ src/components/DataTable.tsx                                           │
│                                                                         │
│ [🌐 Open in Repo] [📜 Blame] [📋 Copy Path] [⭐ Bookmark]              │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐            │
│ │ 📊 COMMITS │ │ 👥 AUTHORS │ │ 📅 AGE     │ │ 🔗 COUPLING│            │
│ │    247     │ │    12      │ │  2y 3mo    │ │    8 files │            │
│ │ ▲ 18 (30d) │ │ Top: @sarah│ │ First: '24 │ │ Max: 72%   │            │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘            │
├─────────────────────────────────────────────────────────────────────────┤
│ [📈 Activity] [👥 Authors] [🔗 Coupling] [📜 Commits] [📊 Insights]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  (Tab content here)                                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Relevant Files

- `frontend/src/components/FileDetailsPanel.tsx` (new)
- `frontend/src/components/shared/StatCard.tsx`
