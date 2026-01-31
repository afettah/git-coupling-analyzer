# Task: Edit & Draft Clusters

**Status:** Partially Implemented  
**Priority:** Medium  
**Last Updated:** January 31, 2026

---

## Summary

Enable visual editing of clusters, renaming, and persistent draft management.

---

## What Has Been Done

- ✅ Basic cluster visualization (ClusteringView, Excalidraw tabs)
- ✅ Snapshot saving/loading implemented
- ✅ Excalidraw integration with auto-generated diagrams

---

## What Needs To Be Done

### Cluster Renaming
- [ ] Enable inline renaming in cluster cards
- [ ] Backend support for updating cluster names in snapshots
- [ ] API endpoint to PATCH cluster names

### Visual Design Surface
- [ ] Extend Excalidraw for manual editing
- [ ] Allow repositioning clusters on canvas
- [ ] Edit cluster shapes and labels
- [ ] Connect clusters visually

### Draft Auto-Save
- [ ] Auto-save drafts to localStorage
- [ ] Restore draft on page reload
- [ ] Show "unsaved changes" indicator
- [ ] Prompt before leaving with unsaved changes

### Export Options
- [ ] Export designed clusters as JSON
- [ ] Export as image (PNG/SVG)
- [ ] Share link generation

---

## Relevant Files

- [frontend/src/components/clustering/SnapshotDetail.tsx](../../../frontend/src/components/clustering/SnapshotDetail.tsx)
- [frontend/src/components/clustering/views/ExcalidrawView.tsx](../../../frontend/src/components/clustering/views/ExcalidrawView.tsx)
- [lfca/api.py](../../../lfca/api.py)
