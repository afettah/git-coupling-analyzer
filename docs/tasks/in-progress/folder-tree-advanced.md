# Task: Folder Tree Advanced Features

**Status:** Partially Implemented  
**Priority:** Medium  
**Last Updated:** January 31, 2026

---

## Summary

Additional folder tree enhancements beyond the completed hints and filters.

---

## What Has Been Done

- ✅ Visual hints system (churn, coupling, recency badges)
- ✅ Quick filters toolbar (hot, stable, recent, coupled, risky)
- ✅ Hover tooltips with detailed stats
- ✅ Settings panel (depth, hints, color palette)

---

## What Needs To Be Done

### Schema Extensions
- [ ] Add `file_hints` table for pre-computed metrics
- [ ] Add `folder_hints` table for aggregated metrics
- [ ] Store hints during analysis phase

### Virtualization (Large Repos)
- [ ] Add react-window or react-virtualized
- [ ] Handle 50k+ files efficiently
- [ ] Lazy loading for deep folders

### Advanced Filters Panel
- [ ] Expandable filter panel with:
  - Author filter
  - Date range filter
  - Extension filter
  - Path pattern filter (glob)
- [ ] Filter presets (save/load)

### Details Panel
- [ ] Create slide-out panel for file/folder details
- [ ] Tabs: Overview, Correlations, History, Graph, Stats
- [ ] Commit history browser
- [ ] Link to Azure DevOps (if configured)

### Keyboard Navigation
- [ ] Arrow keys for navigation
- [ ] Enter to select
- [ ] Escape to close panels

---

## Relevant Files

- [frontend/src/components/FolderTree.tsx](../../../frontend/src/components/FolderTree.tsx)
