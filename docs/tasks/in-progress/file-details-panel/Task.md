# Epic: File & Folder Details Panel

**Status:** ✅ Complete  
**Priority:** High  
**Effort:** 21 days total  
**Last Updated:** February 1, 2026

---

## Summary

Add comprehensive file/folder details panel with git integration, activity charts, and context menus.

---

## Problem

Users exploring the folder tree lack the ability to:
- Deep-dive into file/folder statistics without leaving the tree view
- Visualize change history over time with interactive charts
- Open files directly in the remote git repository
- Navigate to specific commits in the remote repository

---

## QA Testing Results (February 1, 2026)

Comprehensive testing performed using Chrome DevTools MCP. See [09-issues](./09-issues) for full details.

### Working Features ✅
- File Details Panel (all 5 tabs work correctly)
- Folder Details Panel (all 3 tabs work correctly)  
- Context Menu (file and folder options work)
- Git Remote Integration (GitHub links work)
- "Why coupled?" modal, "Go to file" navigation
- URL State Persistence (file path in URL, works with refresh)

### Known Limitations
1. **Lines Added/Deleted = 0** — Extract uses `--name-status` not `--numstat` (by design)
2. **Empty Lineage** — File rename tracking not implemented in extraction
3. **Low Commit Counts** — Analysis may have date filters applied

---

## Recent Fixes (February 1, 2026)

### Bug Fixes Applied
1. **Timestamp Parsing** — Fixed Unix timestamp conversion in API. Activity charts, heatmaps, and commit dates now render correctly.
2. **Double Scrollbar** — Fixed overflow issue in AnalysisDashboard layout.
3. **Age Display** — Now correctly calculates file age from first commit date.
4. **URL State Persistence** — File/folder path now included in URL for sharing and refresh support.

---

## Subtasks

| # | Task | Effort | Status |
|---|------|--------|--------|
| 01 | [Git Remote Detection](./01-git-remote-detection.md) | 2 days | ✅ Complete |
| 02 | [Context Menu](./02-context-menu.md) | 2 days | ✅ Complete |
| 03 | [File Details Basic](./03-file-details-basic.md) | 3 days | ✅ Complete |
| 04 | [Activity Charts](./04-activity-charts.md) | 3 days | ✅ Complete |
| 05 | [Authors & Coupling Tabs](./05-authors-coupling-tabs.md) | 3 days | ✅ Complete |
| 06 | [Commits & Insights Tabs](./06-commits-insights-tabs.md) | 3 days | ✅ Complete |
| 07 | [Folder Details Panel](./07-folder-details-panel.md) | 3 days | ✅ Complete |
| 08 | [Polish & Integration](./08-polish-integration.md) | 2 days | ✅ Complete |

---

## Completed Work

All core features have been implemented and tested:
- ✅ URL State Persistence — File path is in URL for refresh/sharing

### Future Enhancements (Out of Scope)
1. **Line Statistics** — Requires extract changes to use `--numstat`
2. **File Lineage/Renames** — Requires `git log --follow` in extraction
3. **Incremental Analysis** — Update after new commits

---

## Key Features

- **Context Menu** — Right-click on tree nodes for quick actions
- **Details Panel** — Tab-based panel with comprehensive stats
- **Git Integration** — Auto-detect remote URL, link to repo
- **Activity Charts** — Timeline, heatmap, velocity visualizations
- **Commit Browser** — Search and filter commit history

---

## Relevant Files

- `frontend/src/components/FolderTree.tsx`
- `frontend/src/components/FileDetailsPanel.tsx`
- `frontend/src/components/file-details/` — Tab components
- `lfca/api.py` — Backend endpoints
