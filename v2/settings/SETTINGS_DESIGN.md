# V2 Settings — Comprehensive System Design

> **Date:** 2026-02-07  
> **Scope:** Full redesign of project settings, analysis configuration, and parametrization UX  
> **Principle:** No retrocompatibility — design the best target solution. Delete/rewrite old code where noted.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Architecture Overview](#2-architecture-overview)
3. [Data Model — Settings Schema](#3-data-model--settings-schema)
4. [Backend API Design](#4-backend-api-design)
5. [Frontend UX Design](#5-frontend-ux-design)
6. [Analysis Wizard (Run Analysis Flow)](#6-analysis-wizard-run-analysis-flow)
7. [Project Tree Knowledge](#7-project-tree-knowledge)
8. [Reusable Components](#8-reusable-components)
9. [Parameter Registry & Validation](#9-parameter-registry--validation)
10. [Files to Delete / Rewrite](#10-files-to-delete--rewrite)
11. [Implementation Roadmap](#11-implementation-roadmap)

---

## 1. Problem Statement

### Current State
- **Settings page exists** (`src/frontend/src/features/settings/SettingsView.tsx`, ~700 lines) but is a **mock** — saves to `localStorage`, never sent to backend, has no effect on analysis.
- **No backend settings API** — there is no endpoint to persist or retrieve project settings. `repo_meta` table is used ad-hoc for a few key-value pairs (source_path, name, git_web_url).
- **Analysis parameters are hardcoded** — `CouplingConfig` at `src/git-analyzer/git_analyzer/config.py` has 15+ parameters with defaults, but users cannot change them from the UI.
- **Dead parameters** — `min_revisions`, `window_days`, `decay_half_life_days`, `min_component_cooccurrence` are declared but never wired (Issues #1-4 from PARAMS_IMPLEMENTATION_REVIEW.md).
- **No project pre-discovery** — When creating a project, there's no tree exploration, no language detection, no smart defaults.
- **Settings sections are cosmetic** — Display, Notifications, Keyboard Shortcuts sections exist in UI but do nothing.

### Target State
- **Centralized settings** persisted in backend, organized by scope (project, analysis, clustering, display).
- **Smart defaults** based on project discovery (size, languages, structure).
- **Analysis Wizard** with live preview of included/excluded paths, commit ranges, and author filters.
- **All parameters wired** — every configurable value flows from settings → config → analysis engine.
- **Reusable tree/explorer components** across all views.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐    │
│  │ Settings Page │  │ Analysis     │  │ Reusable Components │    │
│  │ (Sections)   │  │ Wizard Modal │  │ • FileTreeExplorer  │    │
│  │              │  │              │  │ • ParamSection       │    │
│  │ • Project    │  │ • Scope      │  │ • RangeSlider        │    │
│  │ • Analysis   │  │ • Filters    │  │ • PatternEditor      │    │
│  │ • Clustering │  │ • Preview    │  │ • PresetSelector     │    │
│  │ • Advanced   │  │ • Run        │  │ • LivePreview        │    │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────┘    │
│         │                  │                                       │
│    ─────┴──────────────────┴────── API Layer ─────────────────    │
└─────────────────────────────────────────────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND                                    │
│                                                                   │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐   │
│  │ Settings Router │  │ Analyzer Router│  │ Discovery Router │   │
│  │ CRUD per scope  │  │ (existing)     │  │ (NEW)            │   │
│  │                 │  │ + config pass  │  │ • tree scan      │   │
│  │ GET/PUT/PATCH   │  │ through        │  │ • lang detect    │   │
│  └────────┬────────┘  └───────┬────────┘  │ • smart defaults │   │
│           │                    │           └────────┬─────────┘   │
│           ▼                    ▼                     ▼             │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              project_settings TABLE (NEW)                 │    │
│  │              project_discovery TABLE (NEW)                │    │
│  │              SQLite (code-intel.sqlite)                    │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model — Settings Schema

### 3.1 New Table: `project_settings`

> **⚠️ DELETE** the ad-hoc `repo_meta` approach for settings. Keep `repo_meta` only for immutable facts (source_path, repo_id creation date). Migrate git_web_url, git_provider, git_default_branch into `project_settings`.

```sql
CREATE TABLE IF NOT EXISTS project_settings (
    scope       TEXT NOT NULL,        -- 'project' | 'analysis' | 'clustering' | 'display'
    key         TEXT NOT NULL,
    value_json  TEXT NOT NULL,         -- JSON-encoded value (supports all types)
    updated_at  TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (scope, key)
);

CREATE INDEX IF NOT EXISTS idx_settings_scope ON project_settings(scope);
```

### 3.2 New Table: `project_discovery`

Stores the result of project pre-analysis (tree structure, languages, stats) so the frontend can render tree explorers and smart filter suggestions without repeated git calls.

```sql
CREATE TABLE IF NOT EXISTS project_discovery (
    path            TEXT PRIMARY KEY,     -- relative file path
    kind            TEXT NOT NULL,        -- 'file' | 'directory'
    extension       TEXT,                 -- '.py', '.ts', '.cs', etc.
    language        TEXT,                 -- detected language
    size_bytes      INTEGER,
    depth           INTEGER NOT NULL,     -- folder nesting depth
    parent_path     TEXT,                 -- parent directory path
    discovered_at   TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_discovery_kind ON project_discovery(kind);
CREATE INDEX IF NOT EXISTS idx_discovery_parent ON project_discovery(parent_path);
CREATE INDEX IF NOT EXISTS idx_discovery_language ON project_discovery(language);
CREATE INDEX IF NOT EXISTS idx_discovery_ext ON project_discovery(extension);
```

### 3.3 New Table: `analysis_profiles`

Named, reusable configuration presets (e.g., "Quick scan", "Deep analysis", "C# Backend Only").

```sql
CREATE TABLE IF NOT EXISTS analysis_profiles (
    profile_id    TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT,
    settings_json TEXT NOT NULL,          -- full serialized settings blob
    is_default    BOOLEAN DEFAULT FALSE,
    created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at    TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### 3.4 Settings Scopes & Keys

#### Scope: `project`
| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `git_web_url` | string\|null | null | Web URL for source links |
| `git_provider` | string\|null | null | "github"\|"gitlab"\|"azure"\|"bitbucket" |
| `git_default_branch` | string | "main" | Default branch name |
| `project_name` | string | (auto) | Display name |

#### Scope: `analysis`
| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `since` | string\|null | null | Git --since date (ISO 8601) |
| `until` | string\|null | null | Git --until date (ISO 8601) |
| `ref` | string | "HEAD" | Branch/tag/commit ref to analyze |
| `all_refs` | bool | false | Analyze all branches |
| `include_paths` | string[] | [] | Paths to include (empty = all) |
| `exclude_paths` | string[] | [] | Paths to exclude |
| `include_extensions` | string[] | [] | Extensions to include (empty = all) |
| `exclude_extensions` | string[] | ["*.lock", "*.min.js", "*.min.css", "*.map", "*.png", "*.jpg", "*.gif", "*.ico", "*.woff", "*.ttf", "*.eot", "*.svg"] | Extensions/patterns to exclude |
| `include_authors` | string[] | [] | Authors to include (empty = all) |
| `exclude_authors` | string[] | [] | Authors to exclude |
| `max_changeset_size` | int | 50 | Max files per commit to consider |
| `min_revisions` | int | 5 | Minimum commits for a file to be included |
| `changeset_mode` | string | "by_commit" | Grouping: by_commit \| by_author_time \| by_ticket_id |
| `author_time_window_hours` | int | 24 | Hours window for author-time grouping |
| `ticket_id_pattern` | string\|null | null | Regex for ticket ID extraction |
| `max_logical_changeset_size` | int | 100 | Max files in logical changeset |
| `merge_handling` | string | "skip" | "skip" \| "first_parent" \| "low_weight" \| "include" |
| `rename_threshold` | int | 60 | --find-renames percentage (40-100) |
| `include_numstat` | bool | true | Parse line add/delete stats |
| `language_preset` | string\|null | null | "dotnet"\|"python"\|"node"\|"java"\|"go"\|null (custom) |
| `validation_mode` | string | "soft" | "strict"\|"soft"\|"permissive" |

#### Scope: `coupling`
| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `min_cooccurrence` | int | 5 | Minimum co-changes to create edge |
| `topk_edges_per_file` | int | 50 | Top-K edges retained per file |
| `component_depth` | int | 2 | Folder depth for component aggregation |
| `min_component_cooccurrence` | int | 5 | Min co-changes at component level |
| `window_days` | int\|null | null | Only consider last N days |
| `decay_half_life_days` | int\|null | null | Exponential decay half-life |

#### Scope: `clustering`
| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `default_algorithm` | string | "louvain" | Default clustering algorithm |
| `default_weight_column` | string | "jaccard" | Default metric for clustering |
| `default_min_weight` | float | 0.1 | Default minimum edge weight |
| `louvain_resolution` | float | 1.0 | Louvain resolution parameter |
| `dbscan_eps` | float | 0.5 | DBSCAN epsilon |
| `dbscan_min_samples` | int | 2 | DBSCAN minimum samples |
| `hierarchical_linkage` | string | "average" | Linkage method |
| `hierarchical_n_clusters` | int\|null | null | Number of clusters (null = auto) |
| `hierarchical_distance_threshold` | float\|null | null | Distance cut threshold |

#### Scope: `display`  
*(Frontend-only, persisted in backend for cross-device sync)*
| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `theme` | string | "dark" | "dark"\|"light"\|"system" |
| `compact_mode` | bool | false | Compact layout |
| `date_format` | string | "relative" | "relative"\|"absolute"\|"iso" |
| `default_view` | string | "dashboard" | Landing page after project select |

### 3.5 Language Presets (Dictionary)

Built-in presets for common tech stacks — **not stored in DB**, hardcoded in both backend and frontend as a shared dictionary.

```python
# src/git-analyzer/git_analyzer/language_presets.py (NEW FILE)

LANGUAGE_PRESETS = {
    "dotnet": {
        "label": ".NET / C#",
        "include_extensions": [".cs", ".csproj", ".sln", ".razor", ".cshtml"],
        "exclude_extensions": [".designer.cs", ".g.cs", ".AssemblyInfo.cs"],
        "exclude_paths": ["bin/", "obj/", "packages/", ".vs/", "TestResults/"],
    },
    "python": {
        "label": "Python",
        "include_extensions": [".py", ".pyi", ".pyx"],
        "exclude_extensions": [],
        "exclude_paths": ["__pycache__/", ".venv/", "venv/", ".tox/", "*.egg-info/", "dist/", "build/"],
    },
    "node": {
        "label": "Node.js / TypeScript",
        "include_extensions": [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte"],
        "exclude_extensions": [".min.js", ".min.css", ".d.ts", ".js.map"],
        "exclude_paths": ["node_modules/", "dist/", "build/", ".next/", ".nuxt/", "coverage/"],
    },
    "java": {
        "label": "Java / Kotlin",
        "include_extensions": [".java", ".kt", ".kts", ".gradle"],
        "exclude_extensions": [],
        "exclude_paths": ["target/", "build/", ".gradle/", ".idea/", "out/"],
    },
    "go": {
        "label": "Go",
        "include_extensions": [".go", ".mod", ".sum"],
        "exclude_extensions": ["_test.go"],  # optional — user can toggle
        "exclude_paths": ["vendor/"],
    },
}
```

```typescript
// src/frontend/src/config/languagePresets.ts (NEW FILE) — mirror of backend
export const LANGUAGE_PRESETS = { /* ... same structure ... */ };
```

---

## 4. Backend API Design

### 4.1 Settings Router — `src/platform/code_intel/routers/settings.py` (NEW FILE)

> **⚠️ REWRITE:** Remove settings-related code from `repos.py` (git_web_url, git_provider, git_default_branch endpoints). Move to this new router.

```
# Settings CRUD
GET    /repos/{repo_id}/settings                    → all scopes
GET    /repos/{repo_id}/settings/{scope}            → one scope
PUT    /repos/{repo_id}/settings/{scope}            → replace scope
PATCH  /repos/{repo_id}/settings/{scope}            → merge partial update

# Analysis Profiles
GET    /repos/{repo_id}/settings/profiles           → list profiles
POST   /repos/{repo_id}/settings/profiles           → create profile
GET    /repos/{repo_id}/settings/profiles/{id}      → get profile
PUT    /repos/{repo_id}/settings/profiles/{id}      → update profile
DELETE /repos/{repo_id}/settings/profiles/{id}      → delete profile

# Smart Defaults
GET    /repos/{repo_id}/settings/smart-defaults     → auto-detected recommendations
```

#### `GET /repos/{repo_id}/settings` Response:

```json
{
  "project": {
    "git_web_url": "https://github.com/org/repo",
    "git_provider": "github",
    "git_default_branch": "main",
    "project_name": "my-repo"
  },
  "analysis": {
    "since": null,
    "until": null,
    "include_paths": [],
    "exclude_paths": ["node_modules/", "dist/"],
    "exclude_extensions": ["*.lock", "*.min.js"],
    "max_changeset_size": 50,
    "merge_handling": "skip",
    "language_preset": "node",
    "...": "..."
  },
  "coupling": { "...": "..." },
  "clustering": { "...": "..." },
  "display": { "...": "..." }
}
```

#### `GET /repos/{repo_id}/settings/smart-defaults` Response:

```json
{
  "detected_languages": ["TypeScript", "Python", "CSS"],
  "primary_language": "TypeScript",
  "suggested_preset": "node",
  "project_size": "medium",
  "file_count": 847,
  "commit_count": 12340,
  "recommended": {
    "analysis": {
      "max_changeset_size": 50,
      "min_revisions": 5,
      "min_cooccurrence": 5,
      "merge_handling": "skip",
      "exclude_paths": ["node_modules/", "dist/", "coverage/", ".next/"],
      "exclude_extensions": ["*.lock", "*.min.js", "*.d.ts"]
    },
    "clustering": {
      "default_algorithm": "louvain",
      "default_min_weight": 0.1
    }
  },
  "rationale": {
    "max_changeset_size": "Medium project (847 files) — default 50 is appropriate",
    "merge_handling": "Repository uses merge commits (detected) — skip recommended"
  }
}
```

### 4.2 Discovery Router — `src/platform/code_intel/routers/discovery.py` (NEW FILE)

```
# Project Discovery
POST   /repos/{repo_id}/discover                     → trigger project tree scan
GET    /repos/{repo_id}/discovery/tree               → get project tree (paginated, filterable)
GET    /repos/{repo_id}/discovery/stats              → language stats, file counts, structure
GET    /repos/{repo_id}/discovery/preview             → preview with current filter settings applied
```

#### `POST /repos/{repo_id}/discover`

Scans the git repository tree (using `git ls-tree -r HEAD`) and populates `project_discovery` table. This runs:
- On project creation (automatic)
- On demand (manual refresh button)

#### `GET /repos/{repo_id}/discovery/tree?parent_path=src/&depth=2`

Returns a hierarchical tree structure, lazy-loadable:

```json
{
  "path": "src/",
  "kind": "directory",
  "children": [
    {
      "path": "src/frontend/",
      "kind": "directory",
      "file_count": 87,
      "languages": {"TypeScript": 72, "CSS": 15}
    },
    {
      "path": "src/backend/",
      "kind": "directory",
      "file_count": 43,
      "languages": {"Python": 43}
    }
  ]
}
```

#### `GET /repos/{repo_id}/discovery/preview`

**Critical endpoint** — accepts the same filter parameters as analysis settings and returns a live preview of what would be included/excluded:

```
GET /repos/{repo_id}/discovery/preview
    ?include_paths=src/
    &exclude_paths=src/frontend/node_modules/
    &include_extensions=.ts,.tsx,.py
    &exclude_extensions=.test.ts,.spec.ts
```

Response:
```json
{
  "included_count": 234,
  "excluded_count": 613,
  "total_count": 847,
  "tree": [
    {
      "path": "src/",
      "included": true,
      "children": [
        {"path": "src/frontend/", "included": true, "included_files": 72, "excluded_files": 15},
        {"path": "src/backend/", "included": true, "included_files": 43, "excluded_files": 0}
      ]
    }
  ],
  "by_language": {
    "TypeScript": {"included": 72, "excluded": 15},
    "Python": {"included": 43, "excluded": 0}
  }
}
```

### 4.3 Wiring Settings → Analysis Engine

> **⚠️ REWRITE:** `src/platform/code_intel/routers/analyzers.py` — the `run_analyzer` endpoint must read settings from DB and merge with request overrides.

Current flow (broken):
```
POST /analyzers/run {config: {}} → hardcoded CouplingConfig defaults
```

New flow:
```
POST /analyzers/run {config_overrides: {}} 
  → load settings from project_settings table
  → merge with config_overrides (overrides win)
  → build CouplingConfig from merged dict
  → pass to orchestrator
```

```python
# In analyzers.py run_analyzer():
settings = load_project_settings(storage, scope="analysis")
settings.update(load_project_settings(storage, scope="coupling"))
settings.update(request.config_overrides)  # caller overrides win
coupling_config = CouplingConfig.from_settings(settings)
```

> **⚠️ REWRITE:** `src/git-analyzer/git_analyzer/config.py` — Add `from_settings()` classmethod, add new fields:

```python
@dataclass
class CouplingConfig:
    # ... existing fields ...
    
    # NEW fields to add:
    merge_handling: str = "skip"           # skip | first_parent | low_weight | include
    rename_threshold: int = 60             # --find-renames percentage
    include_numstat: bool = True           # parse line stats
    include_paths: list[str] = field(default_factory=list)
    exclude_paths: list[str] = field(default_factory=list)
    include_extensions: list[str] = field(default_factory=list)
    exclude_extensions: list[str] = field(default_factory=lambda: [
        "*.lock", "*.min.js", "*.min.css", "*.map",
        "*.png", "*.jpg", "*.gif", "*.ico",
        "*.woff", "*.ttf", "*.eot", "*.svg"
    ])
    include_authors: list[str] = field(default_factory=list)
    exclude_authors: list[str] = field(default_factory=list)
    since: str | None = None
    until: str | None = None
    ref: str = "HEAD"
    all_refs: bool = False
    
    @classmethod
    def from_settings(cls, settings: dict) -> "CouplingConfig":
        """Build from merged settings dict (analysis + coupling scopes)."""
        field_names = {f.name for f in fields(cls)}
        return cls(**{k: v for k, v in settings.items() if k in field_names})
```

> **⚠️ REWRITE:** `src/git-analyzer/git_analyzer/git.py` — `iter_log()` must use config fields instead of hardcoded values:

```python
# CURRENT (hardcoded):
cmd += ["--find-renames=60%"]

# TARGET:
cmd += [f"--find-renames={config.rename_threshold}%"]

# Add merge handling:
if config.merge_handling == "skip":
    cmd += ["--no-merges"]
elif config.merge_handling == "first_parent":
    cmd += ["--first-parent"]

# Add numstat:
if config.include_numstat:
    cmd += ["--numstat"]

# Add path filters at git level:
if config.include_paths:
    cmd += ["--"] + config.include_paths
```

> **⚠️ REWRITE:** `src/git-analyzer/git_analyzer/extract.py` — Must wire `min_revisions` (Issue #1), author filters, extension filters, and merge handling logic.

---

## 5. Frontend UX Design

### 5.1 Settings Page Redesign

> **⚠️ DELETE & REWRITE:** `src/frontend/src/features/settings/SettingsView.tsx` — current 700-line monolith. Replace with composable section components.

**New file structure:**
```
src/frontend/src/features/settings/
├── SettingsView.tsx                 # Shell: sidebar nav + section router
├── sections/
│   ├── ProjectSection.tsx           # Project name, git URL, provider
│   ├── AnalysisSection.tsx          # All analysis params (the main one)
│   ├── CouplingSection.tsx          # Edge computation params
│   ├── ClusteringSection.tsx        # Algorithm defaults
│   ├── AdvancedSection.tsx          # Validation, performance tuning
│   └── DisplaySection.tsx           # Theme, date format, compact mode
├── components/
│   ├── ParamGroup.tsx               # Collapsible group of related params
│   ├── ParamField.tsx               # Single param: label + input + help tooltip
│   ├── ParamSlider.tsx              # Range slider with min/max/step + value label
│   ├── PatternListEditor.tsx        # Add/remove patterns (extensions, paths)
│   ├── PresetSelector.tsx           # Language preset dropdown with preview
│   └── SettingsSidebar.tsx          # Section navigation
├── hooks/
│   ├── useSettings.ts               # Load/save settings via API
│   └── useSmartDefaults.ts          # Fetch smart defaults
└── types.ts                         # All settings type definitions
```

**New API client:**
```
src/frontend/src/api/settings.ts      (NEW FILE)
  - getSettings(repoId): Promise<AllSettings>
  - updateSettings(repoId, scope, data): Promise<void>
  - getSmartDefaults(repoId): Promise<SmartDefaults>
  - listProfiles(repoId): Promise<Profile[]>
  - createProfile(repoId, data): Promise<Profile>
  - deleteProfile(repoId, profileId): Promise<void>
```

### 5.2 Section Layout

Each section follows a consistent pattern:

```
┌─────────────────────────────────────────────────────────────┐
│ 📊 Analysis Configuration                                    │
│ Configure how git history is analyzed for coupling detection │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─ Scope & Filters ─────────────────────────────────────┐  │
│  │                                                         │  │
│  │  Commit Range                                           │  │
│  │  ┌─────────────┐  ┌─────────────┐                      │  │
│  │  │ Since (from) │  │ Until (to)  │                      │  │
│  │  │ 2025-01-01  │  │ (latest)    │                      │  │
│  │  └─────────────┘  └─────────────┘                      │  │
│  │                                                         │  │
│  │  Branch:  [HEAD ▾]    □ Analyze all branches            │  │
│  │                                                         │  │
│  │  Language Preset: [Node.js / TypeScript ▾] [Preview]    │  │
│  │                                                         │  │
│  │  Merge Handling: ○ Skip (recommended)  ○ First-parent   │  │
│  │                  ○ Low weight           ○ Include all    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Path Filters ────────────────────────────────────────┐  │
│  │  Include Paths:  [+ Add path]                           │  │
│  │    src/                                                  │  │
│  │                                                         │  │
│  │  Exclude Paths:  [+ Add path]                           │  │
│  │    node_modules/  ✕                                      │  │
│  │    dist/          ✕                                      │  │
│  │    coverage/      ✕                                      │  │
│  │                                                         │  │
│  │  📁 [Preview included files tree]                       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ▸ Advanced Parameters                                       │  ← collapsed by default
│    ┌─────────────────────────────────────────────────────┐  │
│    │  Max Changeset Size    [50]        ├──●──────┤ 5-500 │  │
│    │  Min Revisions         [5]         ├───●─────┤ 1-100 │  │
│    │  Changeset Mode        [by_commit ▾]                  │  │
│    │  Rename Threshold      [60%]       ├─────●───┤ 40-100│  │
│    │  Validation Mode       [Soft ▾]                       │  │
│    └─────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Key UX Principles

1. **Progressive Disclosure** — Show basic settings (scope, preset, paths). Hide advanced params behind collapsible "Advanced" sections.
2. **Live Preview** — Any filter change triggers a debounced call to `/discovery/preview` showing included/excluded file counts in real-time.
3. **Smart Defaults Banner** — On first visit, show: "We detected a Node.js project with 847 files. [Apply recommended settings]"
4. **Param Tooltips** — Every parameter has an `(i)` icon with explanation + impact level (🔴 Critical / 🟡 Medium / 🟢 Low).
5. **Mock Warnings** — For any setting that is not yet wired to the backend, show a subtle badge: `⚠️ Not yet implemented` — so users know.
6. **Profiles** — Users can save current settings as a named profile and switch between profiles.

---

## 6. Analysis Wizard (Run Analysis Flow)

> **⚠️ REWRITE:** `src/frontend/src/features/dashboard/AnalyzerStatusPanel.tsx` — Current "Run Analysis" button triggers a bare POST with empty config. Replace with a wizard modal.

### 6.1 Wizard Steps

```
Step 1: Scope           Step 2: Filters          Step 3: Review & Run
┌──────────────────┐   ┌──────────────────────┐  ┌──────────────────────┐
│ What to analyze   │   │ Fine-tune filters     │  │ Summary              │
│                   │   │                       │  │                      │
│ Commit Range      │   │ Include/Exclude Paths │  │ 847 files            │
│ Since: [        ] │   │ ┌─ Project Tree ────┐ │  │ 12,340 commits       │
│ Until: [        ] │   │ │ ☑ src/            │ │  │ Skip merges: Yes     │
│                   │   │ │   ☑ frontend/     │ │  │ Preset: Node.js      │
│ Branch: [HEAD   ] │   │ │   ☑ backend/      │ │  │                      │
│                   │   │ │ ☐ tests/          │ │  │ Estimated time: ~45s │
│ Preset: [Node ▾] │   │ │ ☐ docs/           │ │  │                      │
│                   │   │ └────────────────────┘ │  │ [◀ Back]  [Run ▶]   │
│ □ Use saved       │   │                       │  │                      │
│   settings        │   │ Authors: [All       ] │  │                      │
│                   │   │                       │  │                      │
│ [Next ▶]          │   │ [◀ Back] [Next ▶]     │  │                      │
└──────────────────┘   └──────────────────────┘  └──────────────────────┘
```

### 6.2 Key Features

- **"Use saved settings"** checkbox — loads from `project_settings` and skips to Step 3.
- **Interactive Tree Filter** (Step 2) — checkboxes on the project tree (from `project_discovery`). Checking/unchecking a folder updates `include_paths` / `exclude_paths`.
- **Live file count** — Bottom bar shows: `234 / 847 files included` updating as filters change.
- **Author filter** — Multi-select with autocomplete from discovered authors.
- **Estimated time** — Based on file/commit count: `< 30s` / `~1 min` / `~5 min` / `> 10 min`.

### 6.3 Progress View

After clicking "Run", the modal transforms into a progress view:

```
┌─────────────────────────────────────────────────┐
│  ⟳ Running Analysis                              │
│                                                   │
│  Stage: Extracting git history                    │
│  ████████████████░░░░░░░░░░░░░░  53%             │
│                                                   │
│  Commits processed: 6,540 / 12,340               │
│  Files discovered: 612                            │
│  Elapsed: 23s                                     │
│                                                   │
│  ┌─ Live Log ────────────────────────────────┐   │
│  │ [23s] Parsing commit a3f2e1d...           │   │
│  │ [22s] 6500 commits processed              │   │
│  │ [18s] Building file entity cache          │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  [Cancel]                                         │
└─────────────────────────────────────────────────┘
```

> **⚠️ IMPROVE:** `src/platform/code_intel/orchestrator.py` — Must support progress streaming via SSE or WebSocket. Currently progress is polled.

**Recommended approach:** Use **Server-Sent Events (SSE)** on a new endpoint:

```
GET /repos/{repo_id}/analyzers/tasks/{task_id}/stream
  → text/event-stream
  → events: progress, stage, log, complete, error
```

---

## 7. Project Tree Knowledge

### 7.1 Discovery Service — `src/git-analyzer/git_analyzer/discovery.py` (NEW FILE)

```python
"""Project discovery — scan repository structure for tree knowledge."""

import subprocess
from pathlib import PurePosixPath

def discover_project_tree(repo_path: str) -> list[dict]:
    """Run git ls-tree and return structured file list."""
    result = subprocess.run(
        ["git", "ls-tree", "-r", "--name-only", "HEAD"],
        cwd=repo_path, capture_output=True, text=True
    )
    
    files = []
    directories = set()
    
    for line in result.stdout.strip().split("\n"):
        if not line:
            continue
        path = PurePosixPath(line)
        ext = path.suffix
        language = detect_language(ext)
        depth = len(path.parts) - 1
        parent = str(path.parent) if path.parent != PurePosixPath(".") else ""
        
        files.append({
            "path": str(path),
            "kind": "file",
            "extension": ext,
            "language": language,
            "depth": depth,
            "parent_path": parent,
        })
        
        # Track all ancestor directories
        for i in range(1, len(path.parts)):
            dir_path = str(PurePosixPath(*path.parts[:i]))
            if dir_path not in directories:
                directories.add(dir_path)
                files.append({
                    "path": dir_path,
                    "kind": "directory",
                    "extension": None,
                    "language": None,
                    "depth": i - 1,
                    "parent_path": str(PurePosixPath(*path.parts[:i-1])) if i > 1 else "",
                })
    
    return files


EXTENSION_LANGUAGE_MAP = {
    ".py": "Python", ".pyi": "Python",
    ".ts": "TypeScript", ".tsx": "TypeScript",
    ".js": "JavaScript", ".jsx": "JavaScript",
    ".cs": "C#", ".csproj": "C#",
    ".java": "Java", ".kt": "Kotlin",
    ".go": "Go",
    ".rs": "Rust",
    ".rb": "Ruby",
    ".php": "PHP",
    ".swift": "Swift",
    ".cpp": "C++", ".cc": "C++", ".h": "C++",
    ".c": "C",
    ".css": "CSS", ".scss": "SCSS", ".less": "LESS",
    ".html": "HTML", ".htm": "HTML",
    ".sql": "SQL",
    ".sh": "Shell", ".bash": "Shell",
    ".yaml": "YAML", ".yml": "YAML",
    ".json": "JSON",
    ".md": "Markdown",
    ".xml": "XML",
}

def detect_language(ext: str) -> str | None:
    return EXTENSION_LANGUAGE_MAP.get(ext.lower())
```

### 7.2 Frontend Tree Component

> See [Section 8: Reusable Components](#8-reusable-components) for `FileTreeExplorer`.

---

## 8. Reusable Components

### 8.1 `FileTreeExplorer` — `src/frontend/src/shared/components/FileTreeExplorer.tsx` (NEW FILE)

Reusable across: Settings path filter, Analysis wizard, File browser, Clustering view.

**Props:**
```typescript
interface FileTreeExplorerProps {
  repoId: string;
  mode: "browse" | "select";          // browse = view only, select = checkboxes
  selectedPaths?: string[];             // pre-selected paths
  onSelectionChange?: (paths: string[]) => void;
  highlightFilter?: (path: string) => "included" | "excluded" | "neutral";
  maxDepth?: number;                    // limit tree depth for performance
  lazyLoad?: boolean;                   // load children on expand (default: true)
  showStats?: boolean;                  // show file counts, languages per folder
  searchable?: boolean;                 // show search bar at top
}
```

**Features:**
- Lazy-load children via `/discovery/tree?parent_path=X`
- Expand/collapse folders
- Checkbox selection with tri-state (all/some/none children)
- Search/filter within tree
- Language color badges on folders
- File count badges

### 8.2 `ParamSection` — `src/frontend/src/shared/components/ParamSection.tsx` (NEW FILE)

Reusable parameter group with collapse, title, description.

```typescript
interface ParamSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;          // default: true
  advanced?: boolean;             // if true, collapsed by default, subtle styling
  children: React.ReactNode;
}
```

### 8.3 `ParamField` — `src/frontend/src/shared/components/ParamField.tsx` (NEW FILE)

Single setting row with label, input, tooltip, and impact badge.

```typescript
interface ParamFieldProps {
  label: string;
  description: string;
  impact?: "critical" | "high" | "medium" | "low";
  notImplemented?: boolean;       // shows "⚠️ Not yet wired" badge
  children: React.ReactNode;      // the actual input element
}
```

### 8.4 `PatternListEditor` — `src/frontend/src/shared/components/PatternListEditor.tsx` (NEW FILE)

For editing lists of patterns (extensions, paths, authors).

```typescript
interface PatternListEditorProps {
  label: string;
  patterns: string[];
  onChange: (patterns: string[]) => void;
  placeholder?: string;
  suggestions?: string[];           // autocomplete suggestions
  validate?: (pattern: string) => string | null;  // return error or null
}
```

### 8.5 Shared Filter System

> **⚠️ REWRITE:** Current filters (`src/frontend/src/stores/filterStore.ts`) are per-view and disconnected. Create a unified filter system.

```
src/frontend/src/shared/filters/
├── FilterBar.tsx                  # Horizontal bar with active filter chips
├── AdvancedFilterPanel.tsx        # Expandable panel with all filter options
├── FilterChip.tsx                 # Single removable filter badge
├── DateRangeFilter.tsx            # Date range picker (since/until)
├── AuthorFilter.tsx               # Multi-select author picker
├── PathFilter.tsx                 # Path include/exclude with tree
├── ExtensionFilter.tsx            # Extension include/exclude
├── useFilters.ts                  # Shared filter hook (replaces filterStore)
└── types.ts                       # Filter type definitions
```

Shared across: File browser, File details, Hotspots view, Clustering view.

---

## 9. Parameter Registry & Validation

### 9.1 Parameter Metadata Registry — `src/git-analyzer/git_analyzer/param_registry.py` (NEW FILE)

Central source of truth for all parameters — used by both backend validation and frontend schema generation.

```python
from dataclasses import dataclass
from typing import Any

@dataclass
class ParamMeta:
    key: str
    scope: str                 # analysis | coupling | clustering
    type: str                  # int | float | string | bool | string[] | enum
    default: Any
    label: str                 # human-readable
    description: str
    min_value: Any = None
    max_value: Any = None
    enum_values: list[str] | None = None
    impact: str = "medium"     # critical | high | medium | low
    advanced: bool = False     # shown in advanced section
    implemented: bool = True   # False = shows "not yet wired" in UI
    category: str = ""         # for grouping within a scope

PARAM_REGISTRY: list[ParamMeta] = [
    ParamMeta(
        key="max_changeset_size", scope="analysis", type="int",
        default=50, label="Max Changeset Size",
        description="Maximum number of files in a single commit to consider for coupling. "
                    "Commits larger than this are either skipped or down-weighted.",
        min_value=5, max_value=500, impact="high", category="Commit Filters"
    ),
    ParamMeta(
        key="min_revisions", scope="analysis", type="int",
        default=5, label="Minimum Revisions",
        description="Files with fewer than this many commits are excluded from coupling analysis. "
                    "Reduces noise from rarely-changed files.",
        min_value=1, max_value=100, impact="high", category="File Filters"
    ),
    ParamMeta(
        key="merge_handling", scope="analysis", type="enum",
        default="skip", label="Merge Commit Handling",
        description="How to handle merge commits. 'skip' excludes them entirely (recommended). "
                    "'first_parent' follows only the main branch. 'low_weight' includes but down-weights.",
        enum_values=["skip", "first_parent", "low_weight", "include"],
        impact="critical", category="Commit Filters"
    ),
    ParamMeta(
        key="decay_half_life_days", scope="coupling", type="int",
        default=None, label="Decay Half-Life (days)",
        description="If set, recent commits are weighted more heavily. A half-life of 180 means "
                    "commits from 6 months ago count half as much as today's.",
        min_value=7, max_value=730, impact="high", advanced=True,
        implemented=False,  # Not yet wired
        category="Temporal Weighting"
    ),
    # ... all 39+ params from PARAMS_IMPLEMENTATION_REVIEW ...
]
```

### 9.2 Expose Schema to Frontend

```
GET /repos/{repo_id}/settings/schema → returns PARAM_REGISTRY as JSON
```

The frontend uses this to **dynamically render** settings forms — no hardcoded form fields needed. Each param's metadata drives:
- Input type (slider, dropdown, text, toggle, pattern-list)
- Validation (min/max/enum)
- Grouping (category → ParamSection)
- Progressive disclosure (advanced flag)
- Implementation status (implemented flag → warning badge)

---

## 10. Files to Delete / Rewrite

### 🗑️ DELETE (replace entirely)

| File | Reason |
|------|--------|
| `src/frontend/src/features/settings/SettingsView.tsx` | 700-line mock monolith. Replace with composable sections (see §5.1) |

### ✏️ REWRITE (significant changes)

| File | Changes |
|------|---------|
| `src/platform/code_intel/schema.py` | Add `project_settings`, `project_discovery`, `analysis_profiles` tables |
| `src/platform/code_intel/routers/repos.py` | Remove git_web_url / git_provider / git_default_branch endpoints → moved to settings router |
| `src/platform/code_intel/routers/analyzers.py` | Load settings from DB before running analysis; pass merged config to orchestrator |
| `src/git-analyzer/git_analyzer/config.py` | Add 12+ new fields, `from_settings()` classmethod |
| `src/git-analyzer/git_analyzer/git.py` | Use config fields for `--find-renames`, `--no-merges`, `--numstat`, `--first-parent`, path filters |
| `src/git-analyzer/git_analyzer/extract.py` | Wire `min_revisions` filtering, author filtering, extension filtering, merge handling |
| `src/git-analyzer/git_analyzer/edges.py` | Wire `decay_half_life_days`, fix Jaccard bug (Issue #7), remove dead changeset penalty (Issue #9) |
| `src/frontend/src/api/git.ts` | Add settings-related API calls |
| `src/frontend/src/features/dashboard/AnalyzerStatusPanel.tsx` | Replace bare "Run" button with wizard modal trigger |
| `src/frontend/src/features/git/ClusteringView.tsx` | Read default params from settings instead of hardcoded |
| `src/frontend/src/stores/filterStore.ts` | Replace with shared filter system |

### 🆕 NEW FILES

| File | Purpose |
|------|---------|
| `src/platform/code_intel/routers/settings.py` | Settings CRUD API |
| `src/platform/code_intel/routers/discovery.py` | Project tree discovery API |
| `src/git-analyzer/git_analyzer/discovery.py` | Project tree scanning service |
| `src/git-analyzer/git_analyzer/language_presets.py` | Language preset dictionaries |
| `src/git-analyzer/git_analyzer/param_registry.py` | Parameter metadata registry |
| `src/frontend/src/api/settings.ts` | Settings API client |
| `src/frontend/src/api/discovery.ts` | Discovery API client |
| `src/frontend/src/config/languagePresets.ts` | Language preset data (frontend mirror) |
| `src/frontend/src/features/settings/sections/*.tsx` | 6 section components |
| `src/frontend/src/features/settings/components/*.tsx` | 5 setting widgets |
| `src/frontend/src/features/settings/hooks/*.ts` | useSettings, useSmartDefaults |
| `src/frontend/src/features/analysis/AnalysisWizard.tsx` | Run analysis wizard modal |
| `src/frontend/src/features/analysis/ProgressView.tsx` | SSE-connected progress view |
| `src/frontend/src/shared/components/FileTreeExplorer.tsx` | Reusable tree browser |
| `src/frontend/src/shared/components/ParamSection.tsx` | Collapsible param group |
| `src/frontend/src/shared/components/ParamField.tsx` | Single param row |
| `src/frontend/src/shared/components/PatternListEditor.tsx` | Pattern list editor |
| `src/frontend/src/shared/filters/*.tsx` | Shared filter system (6 files) |

---

## 11. Implementation Roadmap

### Phase 1: Foundation (Backend Settings + Schema)
1. Add new tables to `schema.py`
2. Create `settings.py` router with CRUD
3. Create `param_registry.py` with all params metadata
4. Create `language_presets.py`
5. Wire `analyzers.py` to read settings before running
6. Update `CouplingConfig` with new fields + `from_settings()`

### Phase 2: Discovery
7. Create `discovery.py` service
8. Create `discovery.py` router
9. Populate `project_discovery` on project creation
10. Expose `/discovery/tree` and `/discovery/preview` endpoints

### Phase 3: Frontend Settings Redesign
11. Create shared components (`ParamSection`, `ParamField`, `PatternListEditor`)
12. Create `settings.ts` and `discovery.ts` API clients
13. Build settings sections (`ProjectSection`, `AnalysisSection`, etc.)
14. Build new `SettingsView.tsx` shell
15. Delete old `SettingsView.tsx`

### Phase 4: Analysis Wizard
16. Create `FileTreeExplorer` shared component
17. Build `AnalysisWizard.tsx` modal with 3 steps
18. Build `ProgressView.tsx` with SSE streaming
19. Add SSE endpoint in backend
20. Update `AnalyzerStatusPanel.tsx` to trigger wizard

### Phase 5: Wire All Parameters
21. Wire `--no-merges` / `--first-parent` in `git.py` (Issue #5)
22. Wire `--numstat` parsing in `extract.py` (Issue #6)
23. Wire `min_revisions` filtering in `extract.py` (Issue #1)
24. Implement `decay_half_life_days` in `edges.py` (Issue #4)
25. Fix Jaccard bug in `edges.py` (Issue #7)
26. Fix one-directional coupling in `api.py` (Issue #10)
27. Wire author/path/extension filters throughout pipeline

### Phase 6: Shared Filters & Polish
28. Build shared filter system
29. Apply shared filters across File browser, Hotspots, Clustering views
30. Add analysis profiles (save/load/switch)
31. Smart defaults endpoint + UI banner

### Do Later
- Display settings (theme, compact mode) — purely cosmetic, low priority
- Notification settings — no notification infrastructure exists yet
- Keyboard shortcuts section — nice-to-have
- Real-time settings preview (show coupling graph changes as params change)

---

## Summary

This design transforms the settings from a non-functional mock into the **nerve center** of the analysis platform. Every parameter flows through a single pipeline:

```
UI Setting → project_settings table → CouplingConfig → git commands → extraction → edges → clustering
```

The key insight is that **settings and analysis configuration are the same thing** — unify them. The Analysis Wizard is just a settings editor with a "Run" button at the end. The Settings page is the same editor without the "Run" button.

**Biggest wins for understanding big projects:**
1. **Path/extension/author filtering** — Focus on what matters, ignore noise
2. **Merge commit handling** — Eliminate the #1 source of false coupling in merge-heavy repos
3. **Language presets** — One-click setup for common stacks
4. **Live tree preview** — See exactly what you're analyzing before you run
5. **Smart defaults** — Auto-detect project size and suggest appropriate thresholds
