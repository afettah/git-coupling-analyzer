# Task: Edit and Draft Clusters

**Status:** Proposed

## Problem
The current UI does not support designing and editing clusters visually, renaming them, or keeping a persistent draft. Users need a dedicated editing workflow for cluster layouts and names, plus a way to export the final design.

## Goal
- Enable renaming clusters from the UI.
- Provide a visual cluster design surface using Excalidraw integration.
- Allow editing cluster shapes and labels on the canvas.
- Auto-save drafts to localStorage and restore on reload.
- Support export of the designed clusters (format TBD, likely JSON + image).

## Relevant files
- frontend/src/components/ClusteringView.tsx
- frontend/src/components/AnalysisDashboard.tsx
- frontend/src/components/FolderTree.tsx
- frontend/src/api.ts
- docs/tasks/in-progress/edit-and-draft.md
