# Parametrable V2 - Dry-Run Validation Report

> Date: 2026-02-08

## 1. What was validated

1. Core reference file paths and line numbers used in design/tasks.
2. Existence checks for referenced paths.
3. End-to-end flow feasibility via code-level walkthrough.
4. Runtime smoke test feasibility in current execution environment.

## 2. Reference consistency results

## 2.1 File path + line references

Command class: static extraction of `path:line` references from updated docs.

Result:

1. Total references checked: 40
2. Invalid references: 0

Meaning:

All referenced baseline code lines in updated docs map to existing files and valid line numbers.

## 2.2 Referenced paths that are intentionally not yet present

Command class: static extraction of `src/...` path tokens from updated docs.

Result:

1. Total path tokens: 46
2. Missing paths: 19

Missing paths are expected planned creations for V2, including:

1. `src/platform/code_intel/routers/tree.py`
2. `src/platform/code_intel/routers/analysis.py`
3. `src/platform/code_intel/routers/analysis_stream.py`
4. `src/git-analyzer/git_analyzer/scanner.py`
5. `src/git-analyzer/git_analyzer/analysis_config.py`
6. `src/git-analyzer/git_analyzer/presets.py`
7. `src/frontend/src/features/project-wizard/ProjectWizard.tsx`
8. `src/frontend/src/features/analysis-configurator/AnalysisConfigurator.tsx`
9. `src/frontend/src/shared/FileTree/FileTree.tsx`
10. `src/frontend/src/hooks/useSSE.ts`

## 3. Flow dry run (logic-level)

## 3.1 Scenario A - create -> configure -> run -> stream

Expected path:

1. Create repo (`POST /repos`) returns state and scan summary.
2. Configurator loads scan + defaults.
3. Tree preview (`POST /tree/preview`) updates as filters change.
4. Save config (`POST /analysis/configs`) returns `config_id`.
5. Run analysis (`POST /analysis/run`) returns `run_id`.
6. Stream progress (`GET /analysis/runs/{run_id}/stream`) until terminal state.

Validation status:

Code-level flow is consistent with updated design and tasks, pending implementation of planned files/endpoints.

## 3.2 Scenario B - validation failure

Expected behavior:

1. Invalid combination returns field-level errors.
2. UI blocks run until errors are resolved.

Validation status:

Specified in design/tasks and aligned with proposed API contract; runtime behavior pending implementation.

## 3.3 Scenario C - large project async scan

Expected behavior:

1. Create repo returns `state=scanning` for large repos.
2. Wizard polls scan endpoint until ready.

Validation status:

Consistent with redesigned repos API task; backend implementation pending.

## 4. Runtime execution constraints in this environment

Attempted runtime-style check via existing quick test path hit sandbox networking restrictions.

Observed issue:

1. Localhost HTTP connection attempt failed with `Operation not permitted` in current sandbox.

Impact:

1. Full HTTP dry run could not be executed in this environment.
2. Validation in this report is static/code-level and contract-level.

## 5. Conclusion

1. Updated docs are internally consistent with current baseline code references.
2. Planned V2 modules are clearly identified as not yet implemented.
3. End-to-end flow is defined with concrete contracts and verification gates, ready for implementation.

