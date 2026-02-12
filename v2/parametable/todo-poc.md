# Parametrable Analysis — POC Todo (Frontend Mocked)

> **Goal**: Validate the full configuration-on-creation UX with mocked data before backend implementation.
> Users must be able to specify project configuration at creation time and choose all options that impact analysis results.
> Config is global to the project intelligence scope (git-only for now).

## Design & Implementation References

- **Design**: `v2/parametable/DESIGN.md` (architecture, data model, API contracts, frontend design §5)
- **Issues/Fixes**: `v2/parametable/PARAMS_IMPLEMENTATION_REVIEW.md` (30 issues, parameter inventory)
- **Task details**: `v2/parametable/tasks/01–10` (per-task breakdowns)
- **Progress**: `v2/parametable/progress.md` (current state)

---

## ⚠️ Design Gaps to Fix Before POC

### FIX-1: Config must be global to the project, not per-run
The current design treats config as analysis-run-scoped (`analysis_configs` table). The main objective is **project-level configuration** — a single config attached to the project that governs all analysis behavior. The `analysis_configs` table should have a `repo_id` foreign key and a concept of "active config" per project.

**Action**: Update `DESIGN.md` §3.1.1 `analysis_configs` to add `repo_id TEXT NOT NULL` and `is_active BOOLEAN DEFAULT FALSE`. The project wizard sets the initial active config; users can switch configs later.

### FIX-2: Configuration must happen at project creation, not after
The current frontend has `GitAnalysisConfigurator.tsx` inside `features/settings/` — a post-creation settings page. The design's `ProjectWizard` (§5.1) is correct but was never implemented. The POC must validate the wizard flow: **Repository → Scan → Preset → Configure → Review**.

### FIX-3: Existing GitAnalysisConfigurator should be reusable, not duplicated
`GitAnalysisConfigurator.tsx` (598 lines) already implements preset cards, important/advanced params, tooltips, validation. The POC wizard's ConfigureStep should **embed** this component, not rebuild it. Same for the tree preview — the FileTree component should be shared between wizard, configurator, and explorer.

### FIX-4: Missing scan-driven smart defaults
The design specifies smart defaults computed from scan results (§6.2) — e.g., lower thresholds for small repos, decay for large repos, auto-preset from detected languages/frameworks. The current `gitAnalysisConfig.ts` has static defaults. The POC must mock scan-based default computation to validate the UX.

---

## POC Tasks

### POC-1: Mock Data Layer
Create mock services that simulate all backend APIs the wizard needs. No real HTTP calls.

**Files to create**:
- `src/frontend/src/mocks/scanMock.ts` — mock scan results (languages, frameworks, file counts, commit counts)
- `src/frontend/src/mocks/treeMock.ts` — mock tree data with included/excluded/partial status
- `src/frontend/src/mocks/configMock.ts` — mock config CRUD (create, read, update, validate)
- `src/frontend/src/mocks/presetsMock.ts` — mock presets with scan-driven suggestions
- `src/frontend/src/mocks/progressMock.ts` — mock SSE progress events (simulated with setInterval)

**Mock scan response** (per DESIGN.md §4.2):
```json
{
  "scan_id": "mock_scan_001",
  "total_files": 1245,
  "total_dirs": 98,
  "commit_count": 4520,
  "languages": {"typescript": 342, "python": 128, "css": 45},
  "frameworks": ["react", "fastapi"]
}
```

**Mock tree preview** (per DESIGN.md §4.3):
```json
[
  { "path": "src", "name": "src", "kind": "dir", "status": "partial", "children": [...] },
  { "path": "node_modules", "name": "node_modules", "kind": "dir", "status": "excluded" }
]
```

### POC-2: Shared FileTree Component
Implement the reusable FileTree with tri-state visual (included/excluded/partial). Ref: DESIGN.md §5.2, task `06_frontend_filetree.md`.

**Files to create**:
- `src/frontend/src/shared/FileTree/FileTree.tsx`
- `src/frontend/src/shared/FileTree/TreeNode.tsx`
- `src/frontend/src/shared/FileTree/useFileTree.ts`
- `src/frontend/src/shared/FileTree/index.ts`

**Key behaviors to validate**:
- Expand/collapse directories
- Tri-state coloring: green (included), red/dimmed (excluded), amber (partial)
- Language badges on files
- Virtualized rendering (can use mock data with 500+ nodes)
- Selection/deselection propagates to children
- Debounced filter preview update (simulated with mock delay)

### POC-3: Project Creation Wizard
Multi-step wizard that replaces the current `CreateRepoModal`. Ref: DESIGN.md §5.1, task `08_project_wizard_ui.md`.

**Files to create**:
- `src/frontend/src/features/project-wizard/ProjectWizard.tsx`
- `src/frontend/src/features/project-wizard/steps/RepositoryStep.tsx`
- `src/frontend/src/features/project-wizard/steps/ScanResultStep.tsx`
- `src/frontend/src/features/project-wizard/steps/PresetStep.tsx`
- `src/frontend/src/features/project-wizard/steps/ConfigureStep.tsx`
- `src/frontend/src/features/project-wizard/steps/ReviewStep.tsx`

**Flow**:
1. **RepositoryStep**: Select/paste repo path (mock: always succeeds)
2. **ScanResultStep**: Show scan summary (languages, frameworks, file/commit counts). Auto-suggested preset highlighted. "Scanning..." skeleton → populated card.
3. **PresetStep**: Choose preset or "Custom". Shows what the preset changes. Scan-driven recommendation badge.
4. **ConfigureStep**: Embeds existing `GitAnalysisConfigurator` with scan-driven defaults applied. Includes live FileTree preview panel (POC-2) side-by-side. Config changes update tree preview in real-time (debounced, mocked).
5. **ReviewStep**: Summary of all chosen params, diff from defaults, validation warnings. "Run Analysis" button.

### POC-4: Smart Defaults from Scan
Implement frontend logic that computes defaults from scan data. Ref: DESIGN.md §6.2.

**File to modify**: `src/frontend/src/features/settings/gitAnalysisConfig.ts`

**Logic** (from design):
- `commit_count < 1000` → lower `min_revisions` (2), lower `min_cooccurrence` (2)
- `commit_count > 100,000` → lower `max_changeset_size` (30), enable `decay_half_life_days` (365)
- `commit_count > 500,000` → enable `window_days` (730)
- Detected languages/frameworks → auto-suggest matching preset

### POC-5: Analysis Progress Mock
Simulate the SSE progress experience. Ref: DESIGN.md §4.5, §5.4, task `05_sse_progress.md`.

**Files to create**:
- `src/frontend/src/hooks/useSSE.ts` (mock version using setInterval)
- Progress display component integrated in wizard's post-run state

**Stages to simulate**: `queued → extracting → building_edges → computing_metrics → completed`

### POC-6: Wire Wizard into App
Replace or add the wizard as the project creation entry point.

**Files to modify**:
- `src/frontend/src/App.tsx` — add wizard route
- `src/frontend/src/features/dashboard/AnalysisDashboard.tsx` — "New Analysis" triggers wizard or configurator (not old settings)

**Key validation**: After wizard completes, user lands on dashboard with mocked analysis results.

### POC-7: Config Persistence (Local)
Extend `gitAnalysisConfig.ts` localStorage persistence to support project-scoped configs.

**Behavior**: Each project (by repo path/id) has its own saved config. Opening configurator loads the project's config, not a global one.

### POC-8: Validation & Error UX
Ensure the configurator shows field-level errors and blocks run on invalid combos. Ref: DESIGN.md §4.4 validator.

**Cases to validate**:
- `changeset_mode = "by_ticket_id"` without `ticket_id_pattern` → error
- `since > until` → error
- `decay_half_life_days < 7` → warning
- All errors visible inline, "Run" button disabled until errors resolved

---

## Validation Criteria (POC Complete When)

1. ✅ User can go through full wizard: Repo → Scan → Preset → Configure → Review → Run
2. ✅ Scan results drive preset suggestion and smart defaults
3. ✅ FileTree preview updates as include/exclude params change
4. ✅ Config is scoped to the project, not global
5. ✅ Validation errors block analysis run with clear messages
6. ✅ Progress simulation shows stage transitions
7. ✅ Existing `GitAnalysisConfigurator` is reused inside wizard (not duplicated)
8. ✅ No real backend calls — everything mocked
