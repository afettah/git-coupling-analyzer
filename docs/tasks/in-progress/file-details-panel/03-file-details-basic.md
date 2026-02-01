# Subtask: File Details Panel - Basic

**Status:** ✅ Complete  
**Effort:** 3 days

---

## Goal

Create the basic file details panel structure with tabs and stats cards.

---

## Tasks

- [x] Create `FileDetailsPanel.tsx` component
- [x] Panel opens as tab in main content area

### Header Section
- [x] File icon and name
- [x] Full path subtitle
- [x] Action buttons: Open in Repo, Blame, Copy Path, Bookmark

### Stats Cards Row
- [x] 📊 **Commits** — Total count, recent (30d)
- [x] 👥 **Authors** — Count, top author
- [x] 📅 **Age** — First commit date, age string
- [x] 🔗 **Coupling** — Coupled file count, max coupling %
- [x] ➕ **Additions** — Total lines added, net
- [x] ➖ **Deletions** — Total lines deleted
- [x] 📏 **Churn Rate** — Changes per week
- [x] ⚠️ **Risk Score** — Calculated score (0-100)

### Tab Navigation
- [x] Activity tab (default)
- [x] Authors tab
- [x] Coupling tab
- [x] Commits tab
- [x] Insights tab

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
