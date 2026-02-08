# Smart Project Analysis - Parametrable Analysis Design

> Date: 2026-02-08
> Status: Design - Ready for implementation
> Scope: Project creation -> scan intelligence -> config-driven analysis -> streaming progress -> exploration
> Compatibility: Temporary migration bridge allowed; final target is a single canonical flow

## Table of Contents

1. Problem Statement
2. Architecture Overview
3. Data Model
4. Backend Design
5. Frontend Design
6. Parameter System
7. Project Tree Knowledge
8. End-to-End Execution Flow
9. File-by-File Action Plan
10. Implementation Order

## 1. Problem Statement

Current limitations:

1. Analysis starts with hidden defaults and no pre-run preview.
2. Parameters are partially exposed but several are not enforced in runtime.
3. Repo creation does not produce scan intelligence (languages/frameworks/tree profile).
4. File tree preview for include/exclude rules is missing.
5. Progress feedback uses coarse polling rather than real-time stream updates.
6. Existing UI for settings/files is monolithic and hard to reuse.

Target outcome:

1. Users can configure and validate analysis before execution.
2. Every exposed parameter is either enforced or rejected with explicit validation error.
3. Project creation immediately yields scan intelligence and suggested defaults/presets.
4. Live tree preview makes filters understandable and safe.
5. Progress is streamed with stage-level status.
6. Components are reusable and scalable for large repos.

## 2. Architecture Overview

```text
Frontend (React)
  ProjectWizard -> AnalysisConfigurator -> AnalysisProgress -> Explorer
       |               |                    |
       |               |                    +-- SSE /analysis/runs/{id}/stream
       |               +-- POST /tree/preview
       +-- POST /repos (auto scan)

Backend (FastAPI)
  /repos       (create/list/delete + scan lifecycle)
  /tree        (browse + live preview from project_tree)
  /analysis    (config CRUD + run/status)
  /stream      (SSE)

Engine (git_analyzer)
  scanner.py          (repo scan intelligence)
  analysis_config.py  (typed runtime config + validation)
  git.py              (config-driven git log execution)
  extract.py          (history extraction + metrics + parquet)
  edges.py            (coupling build + component aggregation)
```

## 3. Data Model

## 3.1 Schema Changes (Target)

### 3.1.1 New tables

```sql
CREATE TABLE IF NOT EXISTS project_scan (
    scan_id         TEXT PRIMARY KEY,
    scanned_at      TEXT NOT NULL,
    total_files     INTEGER NOT NULL DEFAULT 0,
    total_dirs      INTEGER NOT NULL DEFAULT 0,
    commit_count    INTEGER NOT NULL DEFAULT 0,
    default_branch  TEXT,
    languages_json  TEXT,    -- {"python": 1234, "typescript": 567}
    frameworks_json TEXT,    -- ["fastapi", "react"]
    scan_meta_json  TEXT     -- date_range, sample_authors, etc.
);

CREATE TABLE IF NOT EXISTS project_tree (
    path            TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    kind            TEXT NOT NULL,   -- 'file' | 'dir'
    parent_path     TEXT,
    extension       TEXT,
    language        TEXT,
    size_bytes      INTEGER,
    depth           INTEGER NOT NULL,
    scan_id         TEXT NOT NULL REFERENCES project_scan(scan_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tree_parent ON project_tree(parent_path);
CREATE INDEX IF NOT EXISTS idx_tree_kind ON project_tree(kind);
CREATE INDEX IF NOT EXISTS idx_tree_ext ON project_tree(extension);
CREATE INDEX IF NOT EXISTS idx_tree_lang ON project_tree(language);
CREATE INDEX IF NOT EXISTS idx_tree_depth ON project_tree(depth);

CREATE TABLE IF NOT EXISTS analysis_configs (
    config_id       TEXT PRIMARY KEY,
    name            TEXT,

    since           TEXT,
    until           TEXT,
    ref             TEXT DEFAULT 'HEAD',
    all_refs        BOOLEAN DEFAULT FALSE,

    include_authors TEXT,
    exclude_authors TEXT,

    include_paths   TEXT,
    exclude_paths   TEXT,

    include_extensions TEXT,
    exclude_extensions TEXT,

    preset          TEXT,
    preset_config   TEXT,

    max_changeset_size INTEGER DEFAULT 50,
    max_logical_changeset_size INTEGER DEFAULT 100,
    min_files_in_commit INTEGER DEFAULT 1,
    max_files_in_commit INTEGER,
    skip_merge_commits BOOLEAN DEFAULT TRUE,
    first_parent_only BOOLEAN DEFAULT FALSE,

    changeset_mode  TEXT DEFAULT 'by_commit',
    author_time_window_hours INTEGER DEFAULT 24,
    ticket_id_pattern TEXT,

    find_renames_threshold INTEGER DEFAULT 60,
    include_numstat BOOLEAN DEFAULT TRUE,
    diff_filter     TEXT,

    min_revisions   INTEGER DEFAULT 3,
    min_cooccurrence INTEGER DEFAULT 3,
    topk_edges_per_file INTEGER DEFAULT 50,

    decay_half_life_days INTEGER,
    window_days     INTEGER,

    component_depth INTEGER DEFAULT 2,
    min_component_cooccurrence INTEGER DEFAULT 3,

    hotspot_threshold INTEGER DEFAULT 50,

    chunk_size_bytes INTEGER DEFAULT 1048576,
    validation_mode TEXT DEFAULT 'soft',
    max_validation_issues INTEGER DEFAULT 200,

    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### 3.1.2 Existing table fixes

```sql
DROP INDEX IF EXISTS idx_entities_qualified;
CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_qualified
    ON entities(qualified_name, kind)
    WHERE qualified_name IS NOT NULL;

ALTER TABLE analysis_tasks ADD COLUMN config_id TEXT;
```

Migration note:

1. Guard `ALTER TABLE` with "column exists" checks for already-initialized DBs.
2. Keep old rows with `config_id = NULL` for backward compatibility.

## 3.2 Storage Layer APIs (Target)

Add methods in `src/platform/code_intel/storage.py`:

```python
def save_project_scan(self, scan: dict) -> None: ...
def get_latest_project_scan(self) -> dict | None: ...
def replace_project_tree(self, scan_id: str, rows: list[dict]) -> None: ...
def browse_project_tree(self, path: str, depth: int, include_files: bool) -> list[dict]: ...
def preview_project_tree(self, filters: TreeFilterRequest) -> list[dict]: ...

def create_analysis_config(self, config: dict) -> str: ...
def update_analysis_config(self, config_id: str, patch: dict) -> None: ...
def get_analysis_config(self, config_id: str) -> dict | None: ...
def list_analysis_configs(self) -> list[dict]: ...
def delete_analysis_config(self, config_id: str) -> None: ...
```

## 4. Backend Design

## 4.1 Scanner Service

New file: `src/git-analyzer/git_analyzer/scanner.py`

Responsibilities:

1. Build file list from `git ls-tree`.
2. Compute `commit_count` from `git rev-list --count`.
3. Infer language histogram from extensions.
4. Infer frameworks from markers (`package.json`, `pyproject.toml`, `Cargo.toml`, `*.csproj`).
5. Build normalized tree rows and persist to `project_tree`.

Pseudocode:

```python
class ProjectScanner:
    def scan(self, repo_path: Path, storage: Storage) -> dict:
        files = self._run_lines(["git", "-C", str(repo_path), "ls-tree", "-r", "--name-only", "HEAD"])
        commit_count = int(self._run_text(["git", "-C", str(repo_path), "rev-list", "--count", "HEAD"]))

        rows = self._build_tree_rows(files)
        languages = self._language_histogram(files)
        frameworks = self._detect_frameworks(files)

        scan_id = uuid4().hex
        storage.save_project_scan({
            "scan_id": scan_id,
            "scanned_at": now_iso(),
            "total_files": len([r for r in rows if r["kind"] == "file"]),
            "total_dirs": len([r for r in rows if r["kind"] == "dir"]),
            "commit_count": commit_count,
            "languages_json": json.dumps(languages),
            "frameworks_json": json.dumps(frameworks),
            "scan_meta_json": json.dumps(self._meta(repo_path)),
        })
        storage.replace_project_tree(scan_id, rows)
        return {"scan_id": scan_id, "total_files": ..., "languages": languages, ...}
```

## 4.2 Repos API Redesign

File to rewrite: `src/platform/code_intel/routers/repos.py`

### Endpoints

1. `POST /repos`
2. `POST /repos/{repo_id}/scan`
3. `GET /repos/{repo_id}/scan`

### Create behavior

1. Validate path exists and is git repo.
2. Create repo metadata.
3. Trigger scan automatically.
4. Return:
- small repo: `state="ready"` + embedded scan
- large repo: `state="scanning"` (scan runs in background)

Response contract:

```json
{
  "id": "repo_123",
  "name": "my-project",
  "state": "ready",
  "scan": {
    "scan_id": "scan_abc",
    "total_files": 12450,
    "total_dirs": 913,
    "commit_count": 45200,
    "languages": {"python": 342, "typescript": 128},
    "frameworks": ["fastapi", "react"]
  }
}
```

## 4.3 Tree API

New file: `src/platform/code_intel/routers/tree.py`

### Endpoints

1. `GET /repos/{repo_id}/tree`
2. `POST /repos/{repo_id}/tree/preview`

Request model:

```python
class TreeFilterRequest(BaseModel):
    include_paths: list[str] = []
    exclude_paths: list[str] = []
    include_extensions: list[str] = []
    exclude_extensions: list[str] = []
    preset: str | None = None
    max_depth: int = 6
```

Preview response node:

```python
class TreeNode(BaseModel):
    path: str
    name: str
    kind: Literal["file", "dir"]
    status: Literal["included", "excluded", "partial"]
    extension: str | None = None
    language: str | None = None
    children: list["TreeNode"] = []
```

Status resolution pseudocode:

```python
def resolve_dir_status(child_statuses: list[str], self_match: bool) -> str:
    if not child_statuses:
        return "included" if self_match else "excluded"
    if all(s == "included" for s in child_statuses):
        return "included"
    if all(s == "excluded" for s in child_statuses):
        return "excluded"
    return "partial"
```

## 4.4 Analysis Config API

New file: `src/platform/code_intel/routers/analysis.py`

### Endpoints

1. `POST /repos/{repo_id}/analysis/configs`
2. `GET /repos/{repo_id}/analysis/configs`
3. `GET /repos/{repo_id}/analysis/configs/{config_id}`
4. `PUT /repos/{repo_id}/analysis/configs/{config_id}`
5. `DELETE /repos/{repo_id}/analysis/configs/{config_id}`
6. `POST /repos/{repo_id}/analysis/run`
7. `GET /repos/{repo_id}/analysis/runs`
8. `GET /repos/{repo_id}/analysis/runs/{run_id}`
9. `GET /repos/{repo_id}/presets`
10. `GET /repos/{repo_id}/presets/{name}`

Validation model:

```python
class ConfigIssue(BaseModel):
    field: str
    message: str
    severity: Literal["error", "warning"]
```

Validator pseudocode:

```python
def validate_config(cfg: AnalysisConfig) -> list[ConfigIssue]:
    issues = []
    if cfg.changeset_mode == "by_ticket_id" and not cfg.ticket_id_pattern:
        issues.append(ConfigIssue(field="ticket_id_pattern", message="required for by_ticket_id", severity="error"))
    if cfg.since and cfg.until and parse(cfg.since) > parse(cfg.until):
        issues.append(ConfigIssue(field="since", message="must be <= until", severity="error"))
    if cfg.decay_half_life_days and cfg.decay_half_life_days < 7:
        issues.append(ConfigIssue(field="decay_half_life_days", message="very aggressive decay", severity="warning"))
    return issues
```

Run request:

```json
{ "config_id": "cfg_123" }
```

Run response:

```json
{ "run_id": "a1b2c3d4e5f6", "state": "queued" }
```

## 4.5 SSE Progress Streaming

New file: `src/platform/code_intel/routers/analysis_stream.py`

Endpoint:

1. `GET /repos/{repo_id}/analysis/runs/{run_id}/stream`

Event payload:

```json
{
  "state": "running",
  "progress": 0.42,
  "stage": "building_edges",
  "entity_count": 10234,
  "relationship_count": 220113,
  "elapsed_seconds": 63,
  "error": null
}
```

SSE generator pseudocode:

```python
async def event_generator(repo_id: str, run_id: str):
    last = None
    while True:
        task = storage.get_task(run_id)
        payload = build_payload(task)
        if payload != last:
            yield {"event": "progress", "data": json.dumps(payload)}
            last = payload
        if payload["state"] in {"completed", "failed"}:
            break
        await asyncio.sleep(0.5)
```

## 4.6 Engine Refactor and Critical Fixes

### 4.6.1 Runtime config model

New file: `src/git-analyzer/git_analyzer/analysis_config.py`

```python
@dataclass
class AnalysisConfig:
    since: str | None = None
    until: str | None = None
    ref: str = "HEAD"
    all_refs: bool = False
    include_authors: list[str] = field(default_factory=list)
    exclude_authors: list[str] = field(default_factory=list)
    include_paths: list[str] = field(default_factory=list)
    exclude_paths: list[str] = field(default_factory=list)
    include_extensions: list[str] = field(default_factory=list)
    exclude_extensions: list[str] = field(default_factory=list)
    changeset_mode: str = "by_commit"
    max_changeset_size: int = 50
    max_logical_changeset_size: int = 100
    min_revisions: int = 3
    min_cooccurrence: int = 3
    decay_half_life_days: int | None = None
    ...
```

### 4.6.2 `git.py` changes

Current baseline is hardcoded:

1. `--find-renames=60%`
2. no `--numstat`
3. no merge strategy flags

Target command builder:

```python
def build_git_log_args(repo_path: Path, cfg: AnalysisConfig) -> list[str]:
    args = ["git", "-C", str(repo_path), "log", "--name-status", "--date-order", "-z"]
    args.append(f"--find-renames={cfg.find_renames_threshold}%")
    if cfg.skip_merge_commits:
        args.append("--no-merges")
    if cfg.first_parent_only:
        args.append("--first-parent")
    if cfg.include_numstat:
        args.append("--numstat")
    if cfg.diff_filter:
        args.append(f"--diff-filter={cfg.diff_filter}")
    if cfg.since:
        args.append(f"--since={cfg.since}")
    if cfg.until:
        args.append(f"--until={cfg.until}")
    if cfg.all_refs:
        args.append("--all")
    else:
        args.append(cfg.ref)
    if cfg.include_paths:
        args.append("--")
        args.extend(cfg.include_paths)
    return args
```

### 4.6.3 `extract.py` changes

Fixes:

1. Remove early large-commit drop from extractor loop.
2. Parse numstat records and populate `changes.parquet` line fields.
3. Add entity cache.
4. Apply include/exclude file logic.

Pseudocode:

```python
self._entity_cache: dict[str, int] = {}

def get_or_create_file_id(path: str) -> int:
    if path in self._entity_cache:
        return self._entity_cache[path]
    eid = storage.get_or_create_entity(kind="file", name=Path(path).name, qualified_name=path)
    self._entity_cache[path] = eid
    return eid
```

### 4.6.4 `edges.py` changes

Fixes:

1. Enforce `min_revisions`.
2. Enforce `min_component_cooccurrence`.
3. Separate raw and weighted counters for Jaccard.
4. Implement decay.

Pseudocode:

```python
pair_raw: dict[(int,int), int] = defaultdict(int)
pair_weighted: dict[(int,int), float] = defaultdict(float)

for cs in changesets:
    w = cs.weight
    if cfg.decay_half_life_days:
        age_days = max(0, (now_ts - cs.timestamp) / 86400)
        w *= 2 ** (-age_days / cfg.decay_half_life_days)
    for a, b in combinations(sorted(cs.file_ids), 2):
        pair_raw[(a,b)] += 1
        pair_weighted[(a,b)] += w

eligible = {fid for fid, c in file_counts.items() if c >= cfg.min_revisions}
```

Correct formulas:

```python
jaccard = raw / (src_count + dst_count - raw)
jaccard_weighted = weighted / (src_weight + dst_weight - weighted)
```

### 4.6.5 API correctness fix

`get_file_coupling` should be symmetric (both src and dst direction).

## 5. Frontend Design

## 5.1 Project Wizard

New files:

1. `src/frontend/src/features/project-wizard/ProjectWizard.tsx`
2. `src/frontend/src/features/project-wizard/steps/RepositoryStep.tsx`
3. `src/frontend/src/features/project-wizard/steps/ScanResultStep.tsx`
4. `src/frontend/src/features/project-wizard/steps/PresetStep.tsx`
5. `src/frontend/src/features/project-wizard/steps/ConfigureStep.tsx`
6. `src/frontend/src/features/project-wizard/steps/ReviewStep.tsx`

Flow:

```text
Repository -> Scan Results -> Preset -> Configure -> Review & Run
```

## 5.2 Shared FileTree Component

New files:

1. `src/frontend/src/shared/FileTree/FileTree.tsx`
2. `src/frontend/src/shared/FileTree/TreeNode.tsx`
3. `src/frontend/src/shared/FileTree/useFileTree.ts`
4. `src/frontend/src/shared/FileTree/index.ts`

Props contract:

```tsx
interface FileTreeProps {
  nodes: TreeNode[];
  selectable?: boolean;
  selectedPaths?: Set<string>;
  onSelectionChange?: (paths: Set<string>) => void;
  showLanguageBadges?: boolean;
  dimmedPaths?: Set<string>;
  highlightPattern?: string;
  virtualized?: boolean;
  height?: number;
}
```

Flattening pseudocode:

```ts
function flattenVisible(nodes: TreeNode[], expanded: Set<string>, depth = 0): Row[] {
  const rows: Row[] = [];
  for (const n of nodes) {
    rows.push({ node: n, depth });
    if (n.kind === 'dir' && expanded.has(n.path)) {
      rows.push(...flattenVisible(n.children ?? [], expanded, depth + 1));
    }
  }
  return rows;
}
```

## 5.3 Analysis Configurator

New files:

1. `src/frontend/src/features/analysis-configurator/AnalysisConfigurator.tsx`
2. Section components for each parameter category
3. Live preview components
4. `src/frontend/src/api/analysis.ts`
5. `src/frontend/src/api/tree.ts`

Debounced preview pseudocode:

```ts
const debouncedPreview = useMemo(
  () => debounce(async (filters: TreeFilterRequest) => {
    const data = await treeApi.preview(repoId, filters);
    setPreview(data);
  }, 300),
  [repoId]
);
```

## 5.4 Progress UX

New hook:

1. `src/frontend/src/hooks/useSSE.ts`

Behavior:

1. Connect to stream endpoint.
2. Parse `progress` events.
3. Reconnect on transient disconnect.
4. Stop on `completed`/`failed`.

## 6. Parameter System

## 6.1 Categories

1. Commit range: `since`, `until`, `ref`, `all_refs`
2. Authors: `include_authors`, `exclude_authors`
3. Paths/extensions: include/exclude paths and extensions
4. Changeset: mode, window, ticket pattern, min/max file counts
5. Git options: merges, first-parent, rename threshold, diff filter, numstat
6. Edge computation: revisions/cooccurrence/topk
7. Time weighting: half-life/window
8. Components: depth/min component cooccurrence
9. Performance/validation: chunk size, validation mode, issue cap

## 6.2 Smart Defaults

Pseudocode:

```python
def compute_smart_defaults(scan: ScanResult) -> dict:
    d = {}
    if scan.commit_count < 1000:
        d["min_revisions"] = 2
        d["min_cooccurrence"] = 2
    if scan.commit_count > 100_000:
        d["max_changeset_size"] = 30
        d["topk_edges_per_file"] = 30
        d["decay_half_life_days"] = 365
    if scan.commit_count > 500_000:
        d["window_days"] = 730
    d["preset"] = suggest_preset(scan.languages, scan.frameworks)
    return d
```

## 7. Project Tree Knowledge

## 7.1 Scan command flow

```bash
git -C <repo> ls-tree -r --name-only HEAD
git -C <repo> rev-list --count HEAD
git -C <repo> log --format='%ae' | sort -u | head -200
git -C <repo> log --format='%at' --reverse -1
git -C <repo> log --format='%at' -1
```

## 7.2 Preview SQL pattern

```sql
SELECT path, name, kind, extension, language, depth
FROM project_tree
WHERE depth <= :max_depth
  AND (:no_ext_filter OR extension IN (...))
ORDER BY CASE kind WHEN 'dir' THEN 0 ELSE 1 END, path;
```

## 8. End-to-End Execution Flow

```text
POST /repos
  -> validate repo
  -> create repo meta
  -> auto scan (sync/async)
  -> return state + scan summary

open configurator
  -> load scan + presets + defaults
  -> edit parameters
  -> POST /tree/preview (debounced)

save + run
  -> POST /analysis/configs
  -> POST /analysis/run {config_id}
  -> background analysis starts

progress
  -> GET /analysis/runs/{run_id}/stream
  -> stage/progress updates until terminal state

exploration
  -> read git/deps/semantic views from produced artifacts
```

## 9. File-by-File Action Plan

## 9.1 Create

1. `src/git-analyzer/git_analyzer/scanner.py`
2. `src/git-analyzer/git_analyzer/analysis_config.py`
3. `src/git-analyzer/git_analyzer/presets.py`
4. `src/platform/code_intel/routers/tree.py`
5. `src/platform/code_intel/routers/analysis.py`
6. `src/platform/code_intel/routers/analysis_stream.py`
7. `src/frontend/src/api/tree.ts`
8. `src/frontend/src/api/analysis.ts`
9. `src/frontend/src/hooks/useSSE.ts`
10. `src/frontend/src/shared/FileTree/*`
11. `src/frontend/src/features/project-wizard/*`
12. `src/frontend/src/features/analysis-configurator/*`

## 9.2 Rewrite

1. `src/platform/code_intel/schema.py`
2. `src/platform/code_intel/storage.py`
3. `src/platform/code_intel/routers/repos.py`
4. `src/platform/code_intel/routers/analyzers.py` (temporary compatibility bridge)
5. `src/platform/code_intel/app.py`
6. `src/git-analyzer/git_analyzer/git.py`
7. `src/git-analyzer/git_analyzer/extract.py`
8. `src/git-analyzer/git_analyzer/edges.py`
9. `src/git-analyzer/git_analyzer/changesets.py`
10. `src/git-analyzer/git_analyzer/plugin.py`
11. `src/git-analyzer/git_analyzer/api.py`
12. `src/frontend/src/App.tsx`
13. `src/frontend/src/api/repos.ts`
14. `src/frontend/src/api/git.ts`
15. `src/frontend/src/features/dashboard/AnalysisDashboard.tsx`

## 9.3 Delete (final phase only)

1. `src/frontend/src/features/repos/CreateRepoModal.tsx`
2. `src/frontend/src/features/settings/SettingsView.tsx`
3. `src/frontend/src/features/git/FolderTree.tsx`
4. Legacy-only compatibility code in `routers/analyzers.py`

## 10. Implementation Order

1. Schema + storage primitives
2. Scanner + repos scan lifecycle
3. Tree browse/preview API
4. Config CRUD + validation + run API
5. Engine runtime fixes (git/extract/edges)
6. SSE streaming
7. Frontend FileTree
8. ProjectWizard
9. AnalysisConfigurator
10. Migration cleanup

