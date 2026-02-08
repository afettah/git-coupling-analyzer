# Task 09 - Migration + Cleanup

## Objective

Complete migration to the new flow and remove deprecated modules only after parity and stability checks.

## Dependencies

1. Tasks 01 through 08.

## Detailed Implementation

## 1) Route cutover

1. app entrypoints route to wizard/configurator/progress flows.
2. old modal/settings/tree routes become internal or removed.

## 2) Compatibility bridge handling

1. keep legacy analyzer endpoint while new frontend rolls out.
2. log usage of legacy endpoints.
3. remove bridge after migration completion.

## 3) Removal targets (final phase)

1. `src/frontend/src/features/repos/CreateRepoModal.tsx`
2. `src/frontend/src/features/settings/SettingsView.tsx`
3. `src/frontend/src/features/git/FolderTree.tsx`
4. stale API helpers using direct legacy run paths

## 4) Reference cleanup commands

```bash
rg "CreateRepoModal|SettingsView|FolderTree" src/frontend/src
rg "/analyzers/run|analyzers\.ts" src/frontend/src src/platform/code_intel
```

## 5) Build/runtime checks

1. frontend compile.
2. backend startup with final routers.
3. smoke path: create -> configure -> run -> stream -> explore.

## Verification Matrix

1. no dangling imports for removed files.
2. no dead routes exposed.
3. no regression on run/status visibility.

## Definition of Done

1. only canonical parametrable flow remains.
2. deprecated files are removed safely.

## Files To Touch

1. `src/frontend/src/App.tsx`
2. `src/frontend/src/features/dashboard/AnalysisDashboard.tsx`
3. `src/platform/code_intel/app.py`
4. `src/platform/code_intel/routers/analyzers.py`
5. delete targets listed above

