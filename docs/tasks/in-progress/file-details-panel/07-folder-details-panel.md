# Subtask: Folder Details Panel

**Status:** Not Started  
**Effort:** 3 days

---

## Goal

Create folder-level details panel with aggregated stats and visualizations.

---

## Tasks

### Folder Overview
- [ ] **Stats cards** — Total files, commits, authors, coupling
- [ ] **Health score** — Aggregated from child files
- [ ] **Quick actions** — Open in repo, export

### Hot Files View
- [ ] **Top 10 hottest files** — Sortable table
- [ ] **Churn distribution** — Mini bar chart
- [ ] **Click to open file details**

### Activity Treemap
- [ ] **Treemap visualization** — Size = LOC or commits
- [ ] **Color coding** — Churn level or coupling
- [ ] **Hover for details**

### Coupling Map
- [ ] **Internal coupling** — Files within folder
- [ ] **External coupling** — Dependencies outside folder
- [ ] **Cohesion score** — How well folder is encapsulated

---

## Design

```
┌─────────────────────────────────────────────────────────────────┐
│ 📁 src/components/                                      [✕]     │
│ Contains 47 files in 8 subdirectories                          │
│                                                                  │
│ [🌐 Browse in Repo] [📋 Copy Path] [📊 Export Stats]           │
├─────────────────────────────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐    │
│ │ 📄 FILES   │ │ 📝 COMMITS │ │ 👥 AUTHORS │ │ 🏥 HEALTH  │    │
│ │    47      │ │    892     │ │    15      │ │    78/100  │    │
│ │ 8 folders  │ │ +124 (30d) │ │ Top: @team │ │ 🟢 Good    │    │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│ [🔥 Hot Files] [📊 Treemap] [🔗 Coupling] [📈 Activity]        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🔥 Hot Files (Top 10)                                          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  File                    Commits  Churn   Authors   Last Edit   │
│  DataTable.tsx           247      +4521   12        2d ago      │
│  Modal.tsx               189      +2103   8         5d ago      │
│  Button.tsx              156      +1205   15        1d ago      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Relevant Files

- `frontend/src/components/FolderDetailsPanel.tsx` (new)
- `frontend/src/components/charts/ActivityTreemap.tsx` (new)
