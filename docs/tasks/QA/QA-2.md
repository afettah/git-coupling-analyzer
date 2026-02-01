# QA-2: Advanced & Deep Testing Strategy

> **Version**: 1.0  
> **Status**: Active  
> **Date**: 2026-01-31  
> **Prerequisite**: QA.md basic scenarios must be passing  
> **Focus**: Deep scenarios, frontend E2E, edge cases, stress tests

---

## Overview

This document extends QA.md with **advanced test scenarios** that cover:
1. **Complete User Journeys** - Full workflow from project creation to insights
2. **Frontend E2E Test Scenarios** - All screens, interactions, state management
3. **Complex Backend Scenarios** - Race conditions, data integrity, concurrent operations
4. **Stress & Performance Testing** - Large scale, boundary conditions
5. **Cross-Feature Integration** - Feature combinations that may conflict

---

## Table of Contents

1. [Complete User Journeys](#1-complete-user-journeys)
2. [Frontend E2E Test Scenarios](#2-frontend-e2e-test-scenarios)
3. [Advanced Backend Scenarios](#3-advanced-backend-scenarios)
4. [Stress & Performance Tests](#4-stress--performance-tests)
5. [Cross-Feature Integration](#5-cross-feature-integration)
6. [Accessibility & UX Testing](#6-accessibility--ux-testing)

---

## 1. Complete User Journeys

### Journey 1: First-Time User - Project Discovery

**Persona**: Developer new to LFCA, wants to understand codebase coupling

| Step | Screen | Action | Expected Result | Verification |
|------|--------|--------|-----------------|--------------|
| 1 | Landing `/repos` | Open application | Empty repo list with "New Project" button visible | Button has sky-500 background, Plus icon visible |
| 2 | Landing `/repos` | Click "New Project" button | Modal opens with dark overlay (slate-950/80) | Modal has rounded-2xl corners, X close button |
| 3 | CreateRepoModal | Leave path empty, click Create | Error message: "Repository Path is required" in red-400 | Form submission blocked, field highlighted |
| 4 | CreateRepoModal | Enter invalid path `/nonexistent/path` | Error: "Failed to create project" or "Path does not exist" | API returns 400/404, error displayed |
| 5 | CreateRepoModal | Enter valid path `/home/afettah/workspace/git-coupling-analyzer/tmp/OpenHands` | Modal closes, repo card appears in list | Card shows repo name, path truncated, "not_started" badge |
| 6 | RepoList | Click on newly created repo | Navigates to `/repos/{id}/graph` then redirects to dashboard | URL changes, loading spinner during transition |
| 7 | AnalysisDashboard | View initial state | "Ready to analyze" screen with GitCommit icon | Blue CTA button "Analyze Project Now" visible |
| 8 | AnalysisDashboard | Click "Analyze Project Now" | Analysis starts, progress bar appears | Stage name shows (mirror/extract/edges), percentage updates |
| 9 | AnalysisDashboard | Wait for completion (~2-5 min) | State becomes "complete", tabs become enabled | Graph tab auto-loads, sidebar shows commit/file counts |
| 10 | AnalysisDashboard | Click "Impact Graph" tab | Force-directed graph renders | Nodes visible, center node highlighted in sky-400 |
| 11 | ImpactGraph | Search for file `openhands/core/main.py` | Graph recenters on searched file | URL updates with `?path=...`, impacts list populates |
| 12 | ImpactGraph | Hover over edge | Tooltip shows coupling weight | Weight value between 0-1 displayed |
| 13 | AnalysisDashboard | Click "Folder Tree" tab | Tree structure renders | Root folders visible, expand arrows present |
| 14 | FolderTree | Expand `openhands/` folder | Children folders/files appear | Smooth animation, counts beside folders |
| 15 | FolderTree | Click on a Python file | File details panel opens | Commit count, coupling list, lineage shown |
| 16 | AnalysisDashboard | Click "Clustering" tab | Clustering view loads | Algorithm dropdown, parameter inputs visible |
| 17 | ClusteringView | Run default Louvain clustering | Results computed and saved | Redirects to snapshot detail page |
| 18 | SnapshotDetail | View cluster list | Clusters displayed with file counts | Expandable cluster cards, file lists inside |
| 19 | ClusteringHub | Navigate back to hub | Snapshot appears in history | Timestamp, algorithm name, cluster count shown |
| 20 | Landing `/repos` | Click "Projects" to go back | Repo list with analyzed project | Project shows file_count, commit_count populated |

**Postconditions to Verify:**
- [ ] Database file `data/repos/{id}/lfca.sqlite` exists
- [ ] Parquet files exist in `data/repos/{id}/parquet/`
- [ ] At least one clustering snapshot saved
- [ ] No console errors in browser DevTools

---

### Journey 2: Power User - Multi-Algorithm Comparison

**Persona**: Architect comparing clustering algorithms for architecture review

| Step | Screen | Action | Expected Result | Verification |
|------|--------|--------|-----------------|--------------|
| 1 | ClusteringView | Select "Louvain", resolution=0.5, min_weight=0.05 | Parameters accepted | Input values reflected |
| 2 | ClusteringView | Name: "Louvain Low Resolution", Run | Analysis completes | Redirects to snapshot |
| 3 | SnapshotDetail | Note cluster count and modularity | Values displayed | Record: Clusters=___, Modularity=___ |
| 4 | ClusteringHub | Navigate back, click "Run New Analysis" | ClusteringView opens fresh | Previous params cleared |
| 5 | ClusteringView | Select "Louvain", resolution=2.0, min_weight=0.1 | Parameters accepted | Different values |
| 6 | ClusteringView | Name: "Louvain High Resolution", Run | Analysis completes | Redirects to snapshot |
| 7 | SnapshotDetail | Note cluster count and modularity | More clusters than step 3 | Record: Clusters=___, Modularity=___ |
| 8 | ClusteringHub | Navigate back, click "Run New Analysis" | ClusteringView opens | Fresh state |
| 9 | ClusteringView | Select "Hierarchical", linkage="ward" | Parameters change | Hierarchical-specific params shown |
| 10 | ClusteringView | Name: "Hierarchical Ward", Run | Analysis completes | Different algorithm results |
| 11 | ClusteringHub | View all 3 snapshots | List shows all with different stats | Sortable by date/algorithm |
| 12 | SnapshotDetail | Open each snapshot, compare | Different cluster compositions | Same files, different groupings |

**Expected Algorithm Behavior:**

| Algorithm | Resolution/Params | Expected Clusters | Modularity Range |
|-----------|-------------------|-------------------|------------------|
| Louvain | resolution=0.5 | 5-15 (fewer) | 0.4-0.7 |
| Louvain | resolution=2.0 | 20-50 (more) | 0.3-0.6 |
| Hierarchical | linkage=ward | 10-30 | N/A |
| DBSCAN | eps=0.3, min_samples=3 | Variable + noise | N/A |
| Label Propagation | N/A | 10-40 | Variable |

---

### Journey 3: Debugging Session - Finding Hidden Dependencies

**Persona**: Developer investigating why changing one file breaks seemingly unrelated tests

| Step | Screen | Action | Expected Result | Verification |
|------|--------|--------|-----------------|--------------|
| 1 | ImpactGraph | Search for suspicious file | Graph loads with connections | File in center |
| 2 | ImpactGraph | Examine "Impacts" list on right | Files that change together | Sorted by coupling strength |
| 3 | ImpactGraph | Click top coupled file | Details expand | Jaccard, conditional probs shown |
| 4 | ImpactGraph | View "Lineage" section | File rename/move history | Timeline of path changes |
| 5 | FolderTree | Navigate to same file via tree | Same data accessible | Consistent information |
| 6 | FileDetailsPanel | Open file details | Full coupling breakdown | All metrics: commits, edges, paths |
| 7 | FileDetailsPanel | Click on "Coupled Files" entry | Navigates to that file's details | Bidirectional navigation works |
| 8 | FolderDetailsPanel | Navigate up to folder | Folder aggregate stats | Total commits, file count, avg coupling |
| 9 | ClusteringView | Run clustering to see groupings | Files in same cluster | Visual confirmation of relationship |

---

## 2. Frontend E2E Test Scenarios

### 2.1 Navigation & Routing Tests

#### Test: Direct URL Access

| Test ID | URL Pattern | Precondition | Expected Result |
|---------|-------------|--------------|-----------------|
| NAV-01 | `/` | None | Redirects to `/repos` |
| NAV-02 | `/repos` | No repos exist | Empty state with "New Project" |
| NAV-03 | `/repos` | Repos exist | Repo cards displayed |
| NAV-04 | `/repos/{valid-id}` | Repo exists | Redirects to `/repos/{id}/graph` |
| NAV-05 | `/repos/{invalid-id}` | ID not found | Redirects to `/repos` (after loading) |
| NAV-06 | `/repos/{id}/graph` | Analysis complete | Impact graph renders |
| NAV-07 | `/repos/{id}/graph?path=valid/path.py` | File exists | Graph centered on file |
| NAV-08 | `/repos/{id}/graph?path=invalid/path.py` | File not found | Error message: "File not found" |
| NAV-09 | `/repos/{id}/tree` | Analysis complete | Folder tree renders |
| NAV-10 | `/repos/{id}/clustering` | Analysis complete | Redirects to clustering hub |
| NAV-11 | `/repos/{id}/clustering/new` | Analysis complete | New analysis form |
| NAV-12 | `/repos/{id}/clustering/{snapshot-id}` | Snapshot exists | Snapshot detail view |
| NAV-13 | `/repos/{id}/clustering/{invalid-id}` | Snapshot not found | Error or redirect |
| NAV-14 | `/repos/{id}/settings` | Any state | Settings/options panel |
| NAV-15 | `/repos/{id}/file-details` | No file selected | Redirects to tree |
| NAV-16 | `/repos/{id}/folder-details` | No folder selected | Redirects to tree |

#### Test: Browser Navigation

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| BNAV-01 | Navigate repo→graph→tree, press Back | Returns to graph |
| BNAV-02 | Navigate repo→graph→tree→file, press Back twice | Returns to graph |
| BNAV-03 | Press Forward after Back | Restores forward state |
| BNAV-04 | Bookmark URL, close tab, reopen bookmark | State restored correctly |
| BNAV-05 | Copy URL while on graph, paste in new tab | Same graph view loads |
| BNAV-06 | Refresh page on any screen | State maintained |

---

### 2.2 CreateRepoModal Tests

#### Input Validation

| Test ID | Path Value | Name Value | Expected Result |
|---------|------------|------------|-----------------|
| CRM-01 | Empty | Empty | Error: Required field |
| CRM-02 | `/valid/path` | Empty | Success (auto-generates name) |
| CRM-03 | `/valid/path` | `My Project` | Success with custom name |
| CRM-04 | `not/absolute/path` | Any | Error: Path must be absolute |
| CRM-05 | `/path with spaces/repo` | Any | Success (spaces handled) |
| CRM-06 | `/path/with/no/git` | Any | Error: Not a git repository |
| CRM-07 | Same path as existing repo | Any | Error: Repository already exists |
| CRM-08 | Path with unicode `/données/repo` | Any | Success (unicode handled) |
| CRM-09 | Extremely long path (>500 chars) | Any | Error or truncation |
| CRM-10 | Path ending with `/` | Any | Normalized, success |

#### Modal Behavior

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| CRM-20 | Click X button | Modal closes, no repo created |
| CRM-21 | Click Cancel button | Modal closes, no repo created |
| CRM-22 | Click outside modal (overlay) | Modal remains open (no dismiss on overlay click) |
| CRM-23 | Press Escape key | Modal closes |
| CRM-24 | Submit while loading | Button disabled, no double-submit |
| CRM-25 | Error state, fix input, resubmit | Error clears, submission proceeds |

---

### 2.3 RepoList Component Tests

#### Display States

| Test ID | State | Expected Display |
|---------|-------|------------------|
| RL-01 | No repos | Empty state message, prominent "New Project" button |
| RL-02 | 1 repo, not analyzed | Card with "not_started" badge, grayed stats |
| RL-03 | 1 repo, analysis running | Card with "running" badge, progress indicator |
| RL-04 | 1 repo, analysis complete | Card with stats (commits, files), all counts visible |
| RL-05 | 1 repo, analysis failed | Card with "failed" badge, retry option |
| RL-06 | Multiple repos (5+) | All cards visible, scrollable if needed |
| RL-07 | Many repos (20+) | Performance remains smooth, possible virtualization |

#### Card Interactions

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| RL-20 | Click on repo card | Navigates to `/repos/{id}/graph` |
| RL-21 | Click delete button on card | Confirmation dialog appears |
| RL-22 | Confirm delete | Repo removed from list, data deleted |
| RL-23 | Cancel delete | Dialog closes, repo remains |
| RL-24 | Hover on card | Subtle highlight effect |
| RL-25 | Long repo name | Text truncates with ellipsis |
| RL-26 | Long repo path | Path truncates with ellipsis |

---

### 2.4 AnalysisDashboard Tests

#### Analysis States

| Test ID | State | Expected Display |
|---------|-------|------------------|
| AD-01 | `not_started` | "Ready to analyze" splash, blue CTA |
| AD-02 | `queued` | Queued message, waiting indicator |
| AD-03 | `running` - mirror stage | Progress bar, "Mirroring repository" |
| AD-04 | `running` - extract stage | Progress bar, "Extracting changesets" |
| AD-05 | `running` - edges stage | Progress bar, "Computing edges" |
| AD-06 | `complete` | All tabs enabled, graph auto-loads |
| AD-07 | `failed` | Red error panel, error message, retry button |

#### Progress Verification

| Test ID | Scenario | Expected Result |
|---------|----------|-----------------|
| AD-20 | Analysis starts | Progress shows 0%, stage "mirror" |
| AD-21 | Mid-analysis | Progress increases, commit count updates |
| AD-22 | Analysis completes | Progress 100%, state transitions |
| AD-23 | Analysis fails mid-way | Error state, partial progress visible |
| AD-24 | Re-analyze complete repo | New analysis starts, old data replaced |

#### Sidebar Behavior

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| AD-30 | Click "Projects" (back button) | Returns to repo list |
| AD-31 | Click disabled tab (before analysis) | No navigation, visual feedback |
| AD-32 | Click enabled tab (after analysis) | Tab content loads |
| AD-33 | Sidebar shows repo name | Name displayed, truncated if long |
| AD-34 | Sidebar shows repo path | Path in small mono font |

---

### 2.5 ImpactGraph Tests

#### Graph Rendering

| Test ID | Scenario | Expected Result |
|---------|----------|-----------------|
| IG-01 | Initial load with preset file | Graph renders with center node |
| IG-02 | No file selected | Prompt to select file or use preset |
| IG-03 | File with no coupling | Single node, message "No coupled files" |
| IG-04 | File with 5 coupled files | 6 nodes, 5 edges visible |
| IG-05 | File with 25+ coupled files | Nodes limited to top N, legend shows count |
| IG-06 | Graph physics | Nodes settle into stable positions |

#### Graph Interactions

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| IG-20 | Drag a node | Node moves, connected edges follow |
| IG-21 | Scroll/pinch to zoom | Graph zooms in/out smoothly |
| IG-22 | Pan (drag background) | Entire graph moves |
| IG-23 | Double-click node | Centers and zooms to node |
| IG-24 | Hover over node | Tooltip with full path |
| IG-25 | Hover over edge | Tooltip with coupling weight |
| IG-26 | Click on peripheral node | Graph recenters on clicked node, URL updates |

#### Search Functionality

| Test ID | Search Input | Expected Result |
|---------|--------------|-----------------|
| IG-30 | Exact path `openhands/core/main.py` | File found, graph loads |
| IG-31 | Partial path `main.py` | Autocomplete suggestions appear |
| IG-32 | Non-existent file | Error: "File not found" |
| IG-33 | Empty search, press Enter | No action or error |
| IG-34 | Clear search input | Revert to default/preset view |
| IG-35 | Click suggested preset | Loads that file's graph |

#### Side Panel (Impacts & Lineage)

| Test ID | Scenario | Expected Result |
|---------|----------|-----------------|
| IG-40 | View Impacts list | Top 10 coupled files listed |
| IG-41 | Impact entry shows metrics | Jaccard, P(A|B), co-occurrence count |
| IG-42 | Click Impact entry | Expands or navigates to that file |
| IG-43 | View Lineage section | File path history shown |
| IG-44 | File with no renames | "No path changes detected" message |
| IG-45 | File with renames | Timeline: oldpath → newpath with dates |

---

### 2.6 FolderTree Tests

#### Tree Rendering

| Test ID | Scenario | Expected Result |
|---------|----------|-----------------|
| FT-01 | Initial load | Root level folders visible |
| FT-02 | Folder with 0 files | Empty folder indicator |
| FT-03 | Folder with 100+ files | Virtualized list or pagination |
| FT-04 | Deep nesting (10+ levels) | All levels expandable |
| FT-05 | Mixed folders and files | Folders first, then files (or configurable) |

#### Tree Interactions

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| FT-20 | Click expand arrow on folder | Children load and display |
| FT-21 | Click collapse arrow | Children hidden |
| FT-22 | Click on file name | File details panel opens |
| FT-23 | Click on folder name | Folder details panel opens |
| FT-24 | Double-click folder | Expands/collapses |
| FT-25 | Keyboard navigation (arrows) | Moves focus through tree |
| FT-26 | Press Enter on focused item | Opens details |

#### File/Folder Badges

| Test ID | Badge Type | Expected Display |
|---------|------------|------------------|
| FT-30 | Commit count | Number beside filename |
| FT-31 | Coupling count | Edge count badge |
| FT-32 | Hotspot indicator | Warning icon if high activity |
| FT-33 | Deleted file | Should NOT appear (only current files) |

---

### 2.7 FileDetailsPanel Tests

| Test ID | Scenario | Expected Result |
|---------|----------|-----------------|
| FDP-01 | Open file details | Path, commit count, coupling count shown |
| FDP-02 | View coupled files list | Sorted by Jaccard descending |
| FDP-03 | Empty coupling | "No coupled files found" message |
| FDP-04 | Click coupled file | Navigates to that file's details |
| FDP-05 | View file lineage | Historical paths displayed |
| FDP-06 | Close button (X) | Returns to tree view |
| FDP-07 | Breadcrumb path | Clickable segments navigate to folders |

---

### 2.8 ClusteringView Tests

#### Algorithm Selection

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| CV-01 | Select Louvain | Louvain-specific params appear (resolution) |
| CV-02 | Select Hierarchical | Hierarchical params appear (linkage, n_clusters) |
| CV-03 | Select DBSCAN | DBSCAN params appear (eps, min_samples) |
| CV-04 | Select Label Propagation | Minimal params |
| CV-05 | Click info icon (i) | Algorithm explanation modal opens |

#### Parameter Inputs

| Test ID | Parameter | Value | Expected Result |
|---------|-----------|-------|-----------------|
| CV-10 | min_weight | 0.0 | Accepted (all edges) |
| CV-11 | min_weight | 1.0 | Accepted (only perfect matches) |
| CV-12 | min_weight | -0.5 | Error: Must be >= 0 |
| CV-13 | min_weight | 2.0 | Error: Must be <= 1 |
| CV-14 | resolution | 0.1 | Accepted (fewer clusters) |
| CV-15 | resolution | 10.0 | Accepted (many clusters) |
| CV-16 | folders filter | `openhands/core` | Only that folder analyzed |
| CV-17 | folders filter | Empty | All folders included |
| CV-18 | weight_column | `jaccard` | Default metric |
| CV-19 | weight_column | `jaccard_weighted` | Alternative metric |

#### Run & Results

| Test ID | Scenario | Expected Result |
|---------|----------|-----------------|
| CV-20 | Run with valid params | Loading spinner, then redirect |
| CV-21 | Run with invalid params | Error message, no redirect |
| CV-22 | Snapshot name provided | Saved with custom name |
| CV-23 | Snapshot name empty | Auto-generated name with timestamp |
| CV-24 | Cancel during run | If possible, cancellation; else wait |

---

### 2.9 ClusteringHub & SnapshotDetail Tests

#### Hub Display

| Test ID | Scenario | Expected Result |
|---------|----------|-----------------|
| CH-01 | No snapshots | Empty state, "Run New Analysis" prominent |
| CH-02 | Multiple snapshots | Cards/list with names, dates, algorithms |
| CH-03 | Click snapshot | Navigates to snapshot detail |
| CH-04 | Delete snapshot | Confirmation, then removal |

#### Snapshot Detail

| Test ID | Scenario | Expected Result |
|---------|----------|-----------------|
| SD-01 | View snapshot metadata | Name, date, algorithm, params shown |
| SD-02 | View cluster list | All clusters with file counts |
| SD-03 | Expand cluster | File list appears |
| SD-04 | Search files within snapshot | Filter results |
| SD-05 | Navigate to file from cluster | Opens file details |
| SD-06 | Visualize clusters | Graph or treemap visualization |
| SD-07 | Export/download results | CSV or JSON download |

---

### 2.10 ErrorNotification Component Tests

| Test ID | Trigger | Expected Result |
|---------|---------|-----------------|
| EN-01 | API 500 error | Toast notification appears |
| EN-02 | API 404 error | Contextual error message |
| EN-03 | Network failure | "Network error" notification |
| EN-04 | Multiple errors quickly | Queue/stack, don't overwhelm |
| EN-05 | Dismiss notification | Click X, notification hides |
| EN-06 | Auto-dismiss | After 5-10 seconds, hides |

---

## 3. Advanced Backend Scenarios

### 3.1 Concurrent Operations

| Test ID | Scenario | Expected Result |
|---------|----------|-----------------|
| CONC-01 | Start 2 analyses on same repo | Second request returns "already running" |
| CONC-02 | Start analyses on 2 different repos | Both run in parallel (if supported) or queued |
| CONC-03 | Delete repo while analysis running | Analysis stops/fails gracefully |
| CONC-04 | Query API during analysis | Should return partial data or "in progress" |
| CONC-05 | Multiple users query same repo | Responses consistent, no race conditions |

### 3.2 Data Integrity After Operations

| Test ID | Operation | Verification |
|---------|-----------|--------------|
| DI-01 | Complete analysis | All commits extracted match `git rev-list --count HEAD` ±5% |
| DI-02 | Re-analyze repo | New data replaces old, no duplicates |
| DI-03 | Delete repo | All files in `data/repos/{id}/` removed |
| DI-04 | Server restart mid-analysis | Analysis state recoverable or marked failed |
| DI-05 | Disk full during analysis | Graceful failure, partial data cleaned up |

### 3.3 Complex Git History Scenarios

| Test ID | Git Scenario | Expected LFCA Behavior |
|---------|--------------|------------------------|
| GIT-01 | File renamed 5 times | All paths resolve to same file_id |
| GIT-02 | File moved between folders 3 times | Lineage shows all paths |
| GIT-03 | File deleted then recreated (same path) | Treated as 2 different files or same? (Document behavior) |
| GIT-04 | Binary file changes | Should be tracked (commit appears) |
| GIT-05 | Empty commit (no file changes) | Commit skipped or logged |
| GIT-06 | Commit with 1000+ files | Filtered per bulk_policy setting |
| GIT-07 | Octopus merge (3+ parents) | Merge policy applied, data consistent |
| GIT-08 | Shallow clone repository | Error or partial analysis with warning |
| GIT-09 | Repo with submodules | Submodule changes tracked or excluded (documented) |
| GIT-10 | Detached HEAD state | Should work on current commit |

### 3.4 Edge Calculation Edge Cases

| Test ID | Scenario | Expected Result |
|---------|----------|-----------------|
| EDGE-01 | Two files always change together (100% co-occurrence) | Jaccard = 1.0, P(A|B) = 1.0 |
| EDGE-02 | File changes alone 99 times, with partner 1 time | Jaccard very low, partnership weak |
| EDGE-03 | File A → B unidirectional (B always with A, A often alone) | P(B|A) < P(A|B) |
| EDGE-04 | Triangle: A-B, B-C, A-C all coupled | All 3 edges exist with appropriate weights |
| EDGE-05 | Hub file (config.py coupled to 100+ files) | topk limiting applied, strongest retained |

---

## 4. Stress & Performance Tests

### 4.1 Large Repository Tests

| Test ID | Metric | Threshold | Expected Result |
|---------|--------|-----------|-----------------|
| PERF-01 | Analysis of 50k commits | < 15 minutes | Completes without timeout |
| PERF-02 | Analysis of 10k files at HEAD | < 10 minutes | All files tracked |
| PERF-03 | Coupling query on 500-connection file | < 2 seconds | Results returned |
| PERF-04 | File tree render with 5k files | < 3 seconds | UI responsive |
| PERF-05 | Clustering on 10k files | < 60 seconds | Results computed |

### 4.2 API Stress Tests

```bash
# Use hey or ab for load testing
hey -n 1000 -c 50 http://localhost:8000/repos/openhands/files

# Expected:
# - 99th percentile < 500ms
# - No 5xx errors
# - Memory stable
```

| Test ID | Endpoint | Concurrent Requests | Expected |
|---------|----------|---------------------|----------|
| API-01 | GET /repos | 100 | < 100ms avg |
| API-02 | GET /repos/{id}/files | 50 | < 200ms avg |
| API-03 | GET /repos/{id}/files/tree | 50 | < 300ms avg |
| API-04 | GET /repos/{id}/coupling | 50 | < 500ms avg |
| API-05 | POST /repos/{id}/clustering/run | 10 | < 30s avg |

### 4.3 Browser Memory Tests

| Test ID | Scenario | Memory Threshold |
|---------|----------|------------------|
| MEM-01 | Initial page load | < 50MB |
| MEM-02 | After graph with 50 nodes | < 100MB |
| MEM-03 | After tree expansion (all folders) | < 150MB |
| MEM-04 | After 10 navigation cycles | No significant leak |
| MEM-05 | Leave tab open 1 hour | Memory stable |

---

## 5. Cross-Feature Integration

### 5.1 Graph ↔ Tree Consistency

| Test ID | Scenario | Verification |
|---------|----------|--------------|
| INT-01 | File shown in graph | Same file findable in tree |
| INT-02 | Coupling count in graph | Matches edge count in file details |
| INT-03 | Delete file externally (git rm) | Re-analyze, file disappears from both |
| INT-04 | Rename file externally | Re-analyze, lineage updated in both |

### 5.2 Clustering ↔ Graph Consistency

| Test ID | Scenario | Verification |
|---------|----------|--------------|
| INT-10 | Files in same cluster | Should have non-zero coupling in graph |
| INT-11 | Files in different clusters | May or may not be coupled (depending on params) |
| INT-12 | Singleton cluster | File has no strong couplings |
| INT-13 | Filter by folder then cluster | Only folder files appear in clusters |

### 5.3 Analysis ↔ All Features

| Test ID | Scenario | Expected |
|---------|----------|----------|
| INT-20 | Re-analyze with different params | All cached data refreshed |
| INT-21 | Partial analysis (interrupted) | Features show consistent partial state |
| INT-22 | Analysis with 0 edges (min_weight too high) | Graph empty, clustering fails gracefully |

---

## 6. Accessibility & UX Testing

### 6.1 Keyboard Navigation

| Test ID | Interaction | Expected Result |
|---------|-------------|-----------------|
| A11Y-01 | Tab through main navigation | All interactive elements reachable |
| A11Y-02 | Enter to activate buttons | Buttons trigger correctly |
| A11Y-03 | Escape to close modals | Modal closes |
| A11Y-04 | Arrow keys in tree | Navigate up/down through items |
| A11Y-05 | Arrow keys in graph | Focus moves between nodes |

### 6.2 Screen Reader Compatibility

| Test ID | Element | Expected Announcement |
|---------|---------|----------------------|
| SR-01 | Repo card | "Repository [name], [status], [stats]" |
| SR-02 | Progress bar | "[X]% complete, stage [name]" |
| SR-03 | Graph node | "File [name], [N] connections" |
| SR-04 | Tree folder | "Folder [name], [N] items, collapsed/expanded" |
| SR-05 | Error notification | "Error: [message]" |

### 6.3 Color Contrast & Visual

| Test ID | Element | Requirement |
|---------|---------|-------------|
| VIS-01 | Text on dark background | Contrast ratio ≥ 4.5:1 |
| VIS-02 | Interactive elements | Clearly distinguishable |
| VIS-03 | Focus indicators | Visible focus ring |
| VIS-04 | Error states | Red coloring with icon (not color-only) |
| VIS-05 | Loading states | Clear visual feedback |

### 6.4 Responsive Design

| Test ID | Viewport | Expected Result |
|---------|----------|-----------------|
| RESP-01 | Desktop (1920px) | Full layout, sidebar + main |
| RESP-02 | Laptop (1366px) | Full layout, slightly compressed |
| RESP-03 | Tablet (768px) | Sidebar collapsible or hidden |
| RESP-04 | Mobile (375px) | Stacked layout, hamburger menu |
| RESP-05 | Ultra-wide (3440px) | Centered content, max-width constraint |

---

## Appendix: Test Execution Checklist

### Pre-Test Setup

- [ ] Fresh database (`rm -rf data/repos/`)
- [ ] API server running (`uvicorn lfca.api:app --reload`)
- [ ] Frontend running (`npm run dev`)
- [ ] Browser DevTools open (Console, Network tabs)
- [ ] OpenHands repo available at expected path

### Test Execution Order

1. **Journey 1** (creates baseline data)
2. **Frontend E2E tests** (depends on data)
3. **Journey 2 & 3** (uses created data)
4. **Advanced Backend** (may corrupt data - run last or restore)
5. **Stress tests** (isolated environment recommended)

### Test Report Template

```markdown
## Test Execution Report

**Date**: YYYY-MM-DD
**Tester**: [Name]
**Environment**: [OS, Browser, Node version, Python version]

### Summary
- Total Tests: ___
- Passed: ___
- Failed: ___
- Blocked: ___

### Failed Tests
| Test ID | Description | Actual Result | Severity |
|---------|-------------|---------------|----------|
| | | | |

### Notes & Observations
[Additional findings, performance observations, UX feedback]
```

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-31 | QA Team | Initial deep testing strategy |
