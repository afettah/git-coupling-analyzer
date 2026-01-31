# Epic: File & Folder Details Panel

**Status:** Not Started  
**Priority:** High  
**Effort:** 21 days total  
**Last Updated:** January 31, 2026

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

## Subtasks

| # | Task | Effort | Status |
|---|------|--------|--------|
| 01 | [Git Remote Detection](./01-git-remote-detection.md) | 2 days | Not Started |
| 02 | [Context Menu](./02-context-menu.md) | 2 days | Not Started |
| 03 | [File Details Basic](./03-file-details-basic.md) | 3 days | Not Started |
| 04 | [Activity Charts](./04-activity-charts.md) | 3 days | Not Started |
| 05 | [Authors & Coupling Tabs](./05-authors-coupling-tabs.md) | 3 days | Not Started |
| 06 | [Commits & Insights Tabs](./06-commits-insights-tabs.md) | 3 days | Not Started |
| 07 | [Folder Details Panel](./07-folder-details-panel.md) | 3 days | Not Started |
| 08 | [Polish & Integration](./08-polish-integration.md) | 2 days | Not Started |

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
- `frontend/src/components/FileDetailsPanel.tsx` (new)
- `lfca/api.py`
